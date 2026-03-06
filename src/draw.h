#pragma once

#include <FastEPD.h>
#include <cstddef>
#include <cstdint>

void drawCenteredIconWithText(FASTEPD* epaper, const uint8_t* icon, const char* const* lines, uint16_t line_spacing,
                              uint16_t icon_spacing);
void drawTextAt(FASTEPD* epaper, const char* text, uint16_t x, uint16_t y);