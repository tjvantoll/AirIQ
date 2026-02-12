# AirIQ

A smart connected product for monitoring air quality.

![AirIQ logo](logo.png)

## Videos

You can learn how to build AirIQ yourself by watching the **Building a Connected Product with Notecard** YouTube series using the links below.

- [Part 1—Connecting Hardware](https://www.youtube.com/watch?v=dbzncnJwadE)
- [Part 2—Configuring Notecard](https://www.youtube.com/watch?v=RPH2FkGINWs)
- [Part 3—Writing Host Firmware](https://www.youtube.com/watch?v=5fb_mx91nOs)

## Hardware

The AirIQ project uses the following hardware.

- [Notecard Cellular](https://shop.blues.com/products/notecard-cellular)
- [Notecarrier X](https://shop.blues.com/products/notecarrier-x)
- [Blues Swan](https://shop.blues.com/collections/feather-mcu/products/swan)
- [Adafruit PMSA003I Air Quality Breakout](https://www.adafruit.com/product/4632)
- [Qwiic cable](https://www.adafruit.com/product/4210)
- [JST cable](https://www.adafruit.com/product/4714)
- [Voltaic 0.3 Watt 3.3 Volt Solar Power System](https://voltaicsystems.com/Solar-System-Lithium-Ion-Capacitor)

## Wiring

To run this project you’ll need to wire the following connections between your Notecarrier X and your Blues Swan.

| Notecarrier Pin | Swan Pin |
|-----------------|----------|
| VMAIN           | VIN      |
| GND             | GND      |
| SDA             | SDA      |
| SCL             | SCL      |
| ATTN            | EN       |
| ALT_DFU_RESET   | RST      |
| ALT_DFU_BOOT    | B0       |
| ALT_DFU_RX      | TX       |
| ALT_DFU_TX      | RX       |

## Config

This project’s Notecard configuration lives in the [config.json](config.json) file. Learn about this configuration in the [Configuring Notecard](https://www.youtube.com/watch?v=RPH2FkGINWs) video.

## Firmware

This project’s host firmware lives in the [firmware](firmware) folder. Learn about this firmware and how to run it in the [Host Firmware]((https://www.youtube.com/watch?v=5fb_mx91nOs)) video.
