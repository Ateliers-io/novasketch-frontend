/**
 * Sketch-RNN Test Utility
 * 
 * Simple test to verify Sketch-RNN integration works.
 * Run with: pnpm tsx src/services/sketchRNN.test.manual.ts
 */

import { loadSketchRNNModel, completeSketch, isSketchRNNReady, getAvailableCategories } from './sketchRNN.service';

async function testSketchRNN() {
    console.log('=== Sketch-RNN Integration Test ===\n');
    
    // 1. Check available categories
    console.log('Available categories:', getAvailableCategories());
    console.log();
    
    // 2. Load a model
    console.log('Loading "cat" model...');
    try {
        await loadSketchRNNModel('cat');
        console.log('✅ Model loaded successfully');
        console.log('Ready:', isSketchRNNReady());
        console.log();
    } catch (error) {
        console.error('❌ Model loading failed:', error);
        return;
    }
    
    // 3. Test completion with sample points (larger stroke)
    console.log('Testing sketch completion...');
    const testPoints = [
        { x: 0, y: 0 },
        { x: 10, y: 2 },
        { x: 20, y: 5 },
        { x: 30, y: 8 },
        { x: 40, y: 10 },
        { x: 50, y: 11 },
        { x: 60, y: 12 }
    ];
    
    try {
        const completed = await completeSketch(testPoints, {
            temperature: 0.35,  // Lower temperature for more predictable output
            numPoints: 40
        });
        
        console.log(`✅ Completion successful!`);
        console.log(`Input points: ${testPoints.length}`);
        console.log(`Output points: ${completed.length}`);
        console.log(`Generated points: ${completed.length - testPoints.length}`);
        console.log();
        
        // Show first few completed points
        console.log('Sample output (first 5 AI-generated points):');
        completed.slice(testPoints.length, testPoints.length + 5).forEach((pt, i) => {
            console.log(`  ${i + 1}. (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`);
        });
        
    } catch (error) {
        console.error('❌ Completion failed:', error);
    }
    
    console.log('\n=== Test Complete ===');
}

// Run the test
testSketchRNN().catch(console.error);
