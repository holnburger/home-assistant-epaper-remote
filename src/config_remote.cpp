#include "config_remote.h"
#include "assets/icons.h"
#include "boards.h"
#include "config.h"
#include "screen.h"
#include "store.h"

#include "secrets.h"

#ifndef WIFI_SSID
#    define WIFI_SSID "Your_SSID"
#    define WIFI_PASSWORD "Your_Password"
#    define HA_URL "ws://192.168.1.1:8123/api/websocket"
#    define HA_TOKEN "Your_Token"
#endif

#if __has_include("config_widgets.h")
#include "config_widgets.h"
#else
void configure_widgets(EntityStore* store, Screen* screen) {
    // Generate your configuration automatically from the web portal!
}
#endif

void configure_remote(Configuration* config, EntityStore* store, Screen* screen) {
    // Configure wifi
    config->wifi_ssid = WIFI_SSID;
    config->wifi_password = WIFI_PASSWORD;

    // Configure home assistant
    // If you're using https, use wss://, otherwise use ws://
    config->home_assistant_url = HA_URL;
    config->home_assistant_token = HA_TOKEN;
    config->root_ca = ISRG_ROOT_X1; // You probably don't need to update this

    // Initialize all widgets and UI components
    configure_widgets(store, screen);
}