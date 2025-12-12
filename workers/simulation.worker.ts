import { FoodSystem, AgentSystem, ParticleSystem } from '../systems';
import { world, clearWorld, agents, food, burrows, particles } from '../core/ecs';
import { getAgentColorRGB } from '../core/utils';
import { spawnAgent, spawnFood, resetIds } from '../entities';

// Worker State
let params: any = {};
let isPaused = false;
let lastTime = performance.now();

// Entity Data Buffers (Re-used to prevent GC)
// We serialize the entire world state into Float32Arrays to transfer to Main Thread
// This is much faster than sending JSON objects
const MAX_ENTITIES = 2000;
const AGENT_STRIDE = 16;
const FOOD_STRIDE = 5;
const BURROW_STRIDE = 5;
const PARTICLE_STRIDE = 10;

const agentData = new Float32Array(MAX_ENTITIES * AGENT_STRIDE);
const foodData = new Float32Array(500 * FOOD_STRIDE);
const burrowData = new Float32Array(200 * BURROW_STRIDE);
const particleData = new Float32Array(2000 * PARTICLE_STRIDE);
const trailData = new Float32Array(MAX_ENTITIES * 20 * 6); // Max trails

const reset = () => {
    clearWorld();
    resetIds();
    for (let i = 0; i < (params.initialPop || 40); i++) spawnAgent();
    for (let i = 0; i < 20; i++) spawnFood(undefined, params.foodValue);
};

const loop = () => {
    const now = performance.now();
    const dt = isPaused ? 0 : Math.min((now - lastTime) / 1000, 0.1) * (params.simulationSpeed || 1.0);
    lastTime = now;

    if (!isPaused && params.initialPop) {
        FoodSystem(dt, params);
        AgentSystem(dt, params, (e) => getAgentColorRGB(e.agent!, params.viewMode || 'selfishness'));
        ParticleSystem(dt);
    }

    // Serialize Data
    let agentCount = 0;
    const allAgents = agents.entities;
    for (const e of allAgents) {
        if (!e.agent || agentCount >= MAX_ENTITIES) break;
        const i = agentCount * AGENT_STRIDE;
        const a = e.agent;
        const rgb = getAgentColorRGB(a, params.viewMode || 'selfishness');
        
        agentData[i+0] = e.id;
        agentData[i+1] = e.position.x;
        agentData[i+2] = e.position.y;
        agentData[i+3] = e.position.z;
        agentData[i+4] = a.heading.x; // We use heading for rotation calculation in renderer
        agentData[i+5] = a.heading.z;
        agentData[i+6] = a.genes.size;
        agentData[i+7] = rgb.r;
        agentData[i+8] = rgb.g;
        agentData[i+9] = rgb.b;
        agentData[i+10] = a.energy;
        agentData[i+11] = a.hopTimer;
        // Enum map for state: 0=wandering, 1=resting, 2=digging, 3=sleeping
        agentData[i+12] = a.state === 'resting' ? 1 : (a.state === 'digging' ? 2 : (a.state === 'sleeping' ? 3 : 0));
        agentData[i+13] = a.currentBurrowId !== null ? 1 : 0; // Hidden flag
        agentData[i+14] = a.age;
        agentData[i+15] = a.genes.speed;
        agentCount++;
    }

    let foodCount = 0;
    const allFood = food.entities;
    for (const e of allFood) {
        if (!e.food || foodCount >= 500) break;
        const i = foodCount * FOOD_STRIDE;
        foodData[i+0] = e.id;
        foodData[i+1] = e.position.x;
        foodData[i+2] = e.position.y;
        foodData[i+3] = e.position.z;
        foodData[i+4] = e.food.value;
        foodCount++;
    }

    let burrowCount = 0;
    const allBurrows = burrows.entities;
    for (const e of allBurrows) {
        if (!e.burrow || burrowCount >= 200) break;
        const i = burrowCount * BURROW_STRIDE;
        burrowData[i+0] = e.id;
        burrowData[i+1] = e.position.x;
        burrowData[i+2] = e.position.y;
        burrowData[i+3] = e.position.z;
        burrowData[i+4] = e.burrow.radius;
        burrowCount++;
    }

    let particleCount = 0;
    const allParticles = particles.entities;
    for (const e of allParticles) {
        if (!e.particle || particleCount >= 2000) break;
        const i = particleCount * PARTICLE_STRIDE;
        const p = e.particle;
        particleData[i+0] = e.id; // -1 usually
        particleData[i+1] = e.position.x;
        particleData[i+2] = e.position.y;
        particleData[i+3] = e.position.z;
        particleData[i+4] = p.scale;
        particleData[i+5] = p.color.r;
        particleData[i+6] = p.color.g;
        particleData[i+7] = p.color.b;
        particleData[i+8] = p.life / p.maxLife; // Normalized life
        // Type map: 0=particle, 1=heart, 2=zzz
        particleData[i+9] = p.type === 'heart' ? 1 : (p.type === 'zzz' ? 2 : 0);
        particleCount++;
    }

    // Stats calculation
    let totalSelfishness = 0;
    for(const e of allAgents) {
        if(e.agent) totalSelfishness += e.agent.genes.selfishness;
    }
    const avgSelfishness = allAgents.length > 0 ? totalSelfishness / allAgents.length : 0;

    // Post data back to main thread
    self.postMessage({
        type: 'RENDER_UPDATE',
        agentCount,
        foodCount,
        burrowCount,
        particleCount,
        agentData: agentData, // We send the buffer view, but wait, structured clone might copy.
        foodData,
        burrowData,
        particleData,
        stats: { count: allAgents.length, avgSelfishness }
    }); // We are not using transferable for now to keep it simple with existing TypedArrays, Chrome handles this efficiently.

    requestAnimationFrame(loop);
};

self.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'INIT') {
        params = msg.params;
        lastTime = performance.now();
        reset();
        loop();
    } else if (msg.type === 'UPDATE_PARAMS') {
        params = { ...params, ...msg.params };
    } else if (msg.type === 'RESET') {
        reset();
    } else if (msg.type === 'PAUSE') {
        isPaused = msg.paused;
        lastTime = performance.now(); // Reset timer on unpause to avoid huge jumps
    }
};