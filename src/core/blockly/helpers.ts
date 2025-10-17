/**
 * Blockly Helper Functions
 * 
 * Utilities for block registration conflict prevention and unique ID generation.
 */

/**
 * Generate a unique block ID to prevent registration conflicts
 * @param baseId - The base identifier for the block
 * @returns A unique block ID with timestamp and random suffix
 */
export function generateUniqueBlockId(baseId: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${baseId}_${timestamp}_${random}`;
}

/**
 * Registry for tracking registered block IDs
 */
export class BlockRegistry {
  private registeredBlocks: Set<string> = new Set();
  
  /**
   * Check if a block ID is already registered
   * @param blockId - The block ID to check
   * @returns True if the block is already registered
   */
  isRegistered(blockId: string): boolean {
    return this.registeredBlocks.has(blockId);
  }
  
  /**
   * Register a block ID and return a unique ID if conflict exists
   * @param baseId - The base block ID
   * @returns A unique block ID (original or generated)
   */
  registerBlock(baseId: string): string {
    if (!this.isRegistered(baseId)) {
      this.registeredBlocks.add(baseId);
      return baseId;
    }
    
    // Generate unique ID if conflict exists
    const uniqueId = generateUniqueBlockId(baseId);
    this.registeredBlocks.add(uniqueId);
    console.warn(`Block ID conflict detected for '${baseId}'. Using unique ID: '${uniqueId}'`);
    return uniqueId;
  }
  
  /**
   * Get all registered block IDs
   * @returns Array of all registered block IDs
   */
  getRegisteredBlocks(): string[] {
    return Array.from(this.registeredBlocks);
  }
  
  /**
   * Clear all registered blocks (for testing)
   */
  clear(): void {
    this.registeredBlocks.clear();
  }
}

// Global registry instance
export const blockRegistry = new BlockRegistry();