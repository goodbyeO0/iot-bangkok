import gpiozero
import time
import signal

# Setup LEDs
led_17 = gpiozero.LED(17) # Green LED
led_27 = gpiozero.LED(27) # Red LED 

try:
    while True:
        # Turn on LED 27, off LED 17
        print("LED 27 ON")
        led_27.on()
        led_17.off()
        time.sleep(30)
        
        # Turn on LED 17, off LED 27
        print("LED 17 ON")
        led_17.on()
        led_27.off()
        time.sleep(30)

except KeyboardInterrupt:
    print("\nProgram stopped by user")
finally:
    # Cleanup
    led_17.off()
    led_27.off()