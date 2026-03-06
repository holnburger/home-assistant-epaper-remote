#include "boards.h"
#include "config_remote.h"
#include "constants.h"
#include "managers/home_assistant.h"
#include "managers/touch.h"
#include "managers/ui.h"
#include "managers/wifi.h"
#include "screen.h"
#include "store.h"
#include "ui_state.h"
#include "widgets/Slider.h"
#include <FastEPD.h>

static Configuration config;

static FASTEPD epaper;
static Screen screen;
static BBCapTouch bbct;
static EntityStore store;
static SharedUIState shared_ui_state;

static UITaskArgs ui_task_args;
static TouchTaskArgs touch_task_args;
static HomeAssistantTaskArgs hass_task_args;

#include <ArduinoOTA.h>
#include <Update.h>
#include <WebServer.h>

static WebServer server(80);

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("M5Paper S3 HA Remote Starting...");

    // Basic hardware initialization
    Wire.begin(TOUCH_SDA, TOUCH_SCL);

    store_init(&store);
    ui_state_init(&shared_ui_state);
    configure_remote(&config, &store, &screen);
    initialize_slider_sprites();

    // Initialize display
    Serial.println("Initializing display...");
    epaper.initPanel(DISPLAY_PANEL);
    epaper.setPanelSize(DISPLAY_HEIGHT, DISPLAY_WIDTH);
    epaper.setRotation(90);
    epaper.einkPower(true);

    // Launch UI task
    ui_task_args.epaper = &epaper;
    ui_task_args.screen = &screen;
    ui_task_args.store = &store;
    ui_task_args.shared_state = &shared_ui_state;
    xTaskCreate(ui_task, "ui", 8192, &ui_task_args, 1, &store.ui_task);

    // Connect to wifi
    Serial.println("Starting WiFi...");
    launch_wifi(&config, &store);

    // Initialize OTA
    ArduinoOTA.setHostname("eink-hass-remote");
    ArduinoOTA.begin();

    // HTTP Update Server
    server.on("/update", HTTP_OPTIONS, []() {
        server.sendHeader("Access-Control-Allow-Origin", "*");
        server.sendHeader("Access-Control-Max-Age", "10000");
        server.sendHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
        server.sendHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        server.send(204);
    });

    server.on(
        "/update", HTTP_POST,
        []() {
            server.sendHeader("Connection", "close");
            server.sendHeader("Access-Control-Allow-Origin", "*");
            server.send(200, "text/plain", (Update.hasError()) ? "FAIL" : "OK");
            delay(500);
            ESP.restart();
        },
        []() {
            HTTPUpload& upload = server.upload();
            if (upload.status == UPLOAD_FILE_START) {
                Serial.printf("Update Start: %s\n", upload.filename.c_str());
                if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
                    Update.printError(Serial);
                }
            } else if (upload.status == UPLOAD_FILE_WRITE) {
                if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
                    Update.printError(Serial);
                }
            } else if (upload.status == UPLOAD_FILE_END) {
                if (Update.end(true)) {
                    Serial.printf("Update Success: %u bytes. Rebooting...\n", upload.totalSize);
                } else {
                    Update.printError(Serial);
                }
            }
        });
    server.onNotFound([]() {
        String msg = "404 Not Found\n\n";
        msg += "URI: ";
        msg += server.uri();
        msg += "\nMethod: ";
        msg += (server.method() == HTTP_GET) ? "GET" : "POST";
        msg += "\n";
        server.send(404, "text/plain", msg);
        Serial.printf("WebServer: 404 for %s\n", server.uri().c_str());
    });
    server.begin();
    Serial.println("WebServer started on port 80");

    // Connect to home assistant
    hass_task_args.config = &config;
    hass_task_args.store = &store;
    xTaskCreate(home_assistant_task, "home_assistant", 8192, &hass_task_args, 1, &store.home_assistant_task);

    // Launch touch task
    touch_task_args.bbct = &bbct;
    touch_task_args.screen = &screen;
    touch_task_args.state = &shared_ui_state;
    touch_task_args.store = &store;
    xTaskCreate(touch_task, "touch", 4096, &touch_task_args, 1, nullptr);
}

void loop() {
    ArduinoOTA.handle();
    server.handleClient();

    static unsigned long last_wifi_check = 0;
    if (millis() - last_wifi_check > 5000) {
        last_wifi_check = millis();
        if (WiFi.status() == WL_CONNECTED) {
            String current_ip = WiFi.localIP().toString();
            Serial.printf("WiFi Connected: %s\n", current_ip.c_str());

            xSemaphoreTake(shared_ui_state.mutex, portMAX_DELAY);
            if (strcmp(shared_ui_state.state.wifi_ip, current_ip.c_str()) != 0) {
                strncpy(shared_ui_state.state.wifi_ip, current_ip.c_str(), 15);
                shared_ui_state.state.wifi_ip[15] = '\0';
                shared_ui_state.version++;
                if (store.ui_task) {
                    xTaskNotifyGive(store.ui_task);
                }
            }
            xSemaphoreGive(shared_ui_state.mutex);
        } else {
            Serial.println("WiFi not connected");
        }
    }

    vTaskDelay(pdMS_TO_TICKS(10));
}
