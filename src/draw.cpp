#include "draw.h"
#include "assets/Montserrat_Regular_26.h"
#include "boards.h"
#include <FastEPD.h>
#include <cstddef>
#include <cstdint>

void drawCenteredIconWithText(FASTEPD* epaper, const uint8_t* icon, const char* const* lines, uint16_t line_spacing,
                              uint16_t icon_spacing) {
    BB_RECT rect;
    epaper->setFont(Montserrat_Regular_26);
    epaper->setTextColor(BBEP_BLACK);

    // Figure out the height of the text
    uint16_t text_height = 0;
    for (size_t i = 0; lines[i] != nullptr; ++i) {
        epaper->getStringBox(lines[i], &rect);
        text_height += rect.h;
        if (i > 0) {
            text_height += line_spacing;
        }
    }

    uint16_t cursor_y;
    if (icon) {
        // Draw the icon
        const int icon_x = DISPLAY_WIDTH / 2 - 256 / 2;
        cursor_y = DISPLAY_HEIGHT / 2 - (256 + icon_spacing + text_height) / 2;
        epaper->loadBMP(icon, icon_x, cursor_y, 0xf, BBEP_BLACK);
        cursor_y += icon_spacing + 256;
    } else {
        cursor_y = DISPLAY_HEIGHT / 2 - text_height / 2;
    }

    // Draw each line
    for (size_t i = 0; lines[i] != nullptr; ++i) {
        epaper->getStringBox(lines[i], &rect);
        const int text_x = DISPLAY_WIDTH / 2 - rect.w / 2;

        epaper->setCursor(text_x, cursor_y);
        epaper->write(lines[i]);

        cursor_y += rect.h + line_spacing;
    }
}

void drawTextAt(FASTEPD* epaper, const char* text, uint16_t x, uint16_t y) {
    epaper->setFont(Montserrat_Regular_26);
    epaper->setTextColor(BBEP_BLACK);
    epaper->setCursor(x, y);
    epaper->write(text);
}
