/* ============================================================================
 * robotku-esp32.ino — Arduino IDE entry point ONLY. Deliberately empty.
 * ----------------------------------------------------------------------------
 * The firmware itself lives in src/main.cpp + src/config.h. That layout is what
 * PlatformIO expects by default (src_dir = src), and it matches the ESP32
 * RoboSchool-Controller project, so the two are drop-in compatible.
 *
 * The Arduino IDE additionally requires a sketch file named after its folder,
 * and it compiles every source file under the sketch's src/ subdirectory
 * recursively — so this stub is all that is needed to keep BOTH toolchains
 * working from the same tree:
 *
 *   PlatformIO   : pio run -t upload        (from this folder)
 *   Arduino IDE  : open this .ino, then Upload
 *
 * Do NOT put code here: the IDE concatenates .ino files into its own
 * translation unit, so setup()/loop() defined here would clash with the real
 * ones in src/main.cpp. See README.md ("Build").
 * ==========================================================================*/
