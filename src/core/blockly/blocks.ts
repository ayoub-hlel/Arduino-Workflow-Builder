// Initialize blocks with duplicate prevention using helpers
import { blockRegistry } from './helpers';

let blocksInitialized = false;

export function initializeBlocks() {
  if (blocksInitialized) {
    console.log('Blocks already initialized, skipping...');
    return;
  }
  
  blocksInitialized = true;
  
  // Clear the block registry for fresh initialization
  blockRegistry.clear();
  
  // Clear any existing duplicate definitions
  if (typeof window !== 'undefined' && (window as any).Blockly) {
    const Blockly = (window as any).Blockly;
    
    // Clear known duplicate definitions
    const duplicateBlocks = ['controls_ifelse', 'controls_for', 'math_number_property'];
    duplicateBlocks.forEach(blockId => {
      if (Blockly.Blocks && Blockly.Blocks[blockId]) {
        delete Blockly.Blocks[blockId];
        console.warn(`Cleared duplicate block definition: ${blockId}`);
      }
    });
  }
  
  console.log('Block initialization complete. Registry cleared and ready for block imports.');
}

// Auto-initialize blocks
initializeBlocks();

import '../../blocks/arduino/blocks';
import '../../blocks/bluetooth/blocks';
import '../../blocks/button/blocks';
import '../../blocks/color/blocks';
import '../../blocks/debug/blocks';
import '../../blocks/ir_remote/blocks';
import '../../blocks/functions/blocks';
import '../../blocks/lcd_screen/blocks';
import '../../blocks/led_matrix/blocks';
import '../../blocks/rgbled/blocks';
import '../../blocks/led/blocks';
import '../../blocks/neopixels/blocks';
import '../../blocks/fastled/blocks';
import '../../blocks/writepin/blocks';
import '../../blocks/digitalsensor/blocks';
import '../../blocks/list/blocks';
import '../../blocks/logic/blocks';
import '../../blocks/loops/blocks';
import '../../blocks/math/blocks';
import '../../blocks/message/blocks';
import '../../blocks/ultrasonic_sensor/blocks';
import '../../blocks/motors/blocks';
import '../../blocks/analogsensor/blocks';
import '../../blocks/rfid/blocks';
import '../../blocks/servo/blocks';
import '../../blocks/temperature/blocks';
import '../../blocks/text/blocks';
import '../../blocks/time/blocks';
import '../../blocks/variables/blocks';

import '../../blocks/thermistor/blocks';
import '../../blocks/passivebuzzer/blocks';
import '../../blocks/steppermotor/blocks';
import '../../blocks/digit4display/blocks';
import '../../blocks/joystick/blocks';