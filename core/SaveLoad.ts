import { Vector3 } from 'three';
import { world, agents, food, burrows } from './ecs';
import { SimulationParams } from './types';
import { getNextAgentId, setNextAgentId, spawnAgent } from '../entities/Agent';
import { getNextFoodId, setNextFoodId, spawnFood } from '../entities/Food';
import { getNextBurrowId, setNextBurrowId, spawnBurrow } from '../entities/Burrow';

export interface SaveState {
  timestamp: number;
  params: SimulationParams;
  nextIds: {
    agent: number;
    food: number;
    burrow: number;
  };
  entities: {
    agents: any[];
    food: any[];
    burrows: any[];
  };
}

export const saveSimulation = (params: SimulationParams) => {
    const saveData: SaveState = {
        timestamp: Date.now(),
        params: params,
        nextIds: {
            agent: getNextAgentId(),
            food: getNextFoodId(),
            burrow: getNextBurrowId()
        },
        entities: {
            agents: agents.entities.map(e => ({
                id: e.id,
                position: e.position.toArray(),
                agent: { 
                    ...e.agent,
                    target: e.agent?.target ? e.agent.target.toArray() : null,
                    heading: e.agent?.heading.toArray(),
                    trail: [] // Trails are transient/visual, don't save to save space
                }
            })),
            food: food.entities.map(e => ({
                id: e.id,
                position: e.position.toArray(),
                value: e.food?.value
            })),
            burrows: burrows.entities.map(e => ({
                id: e.id,
                position: e.position.toArray(),
                burrow: e.burrow
            }))
        }
    };

    const blob = new Blob([JSON.stringify(saveData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rabbit_island_save_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const loadSimulation = (jsonString: string): SaveState => {
    try {
        const data = JSON.parse(jsonString) as SaveState;
        return data;
    } catch (e) {
        console.error("Failed to parse save file", e);
        throw new Error("Invalid save file");
    }
};

export const restoreWorld = (data: SaveState) => {
    // 1. Restore IDs
    setNextAgentId(data.nextIds.agent);
    setNextFoodId(data.nextIds.food);
    setNextBurrowId(data.nextIds.burrow);

    // 2. Restore Burrows (spawn first so agents can reference)
    data.entities.burrows.forEach(b => {
        spawnBurrow(
            new Vector3(b.position[0], b.position[1], b.position[2]),
            b.burrow.ownerId,
            b.burrow.radius, 
            b.burrow,
            b.id
        );
    });

    // 3. Restore Agents
    data.entities.agents.forEach(a => {
        const ag = a.agent;
        // Fix vector properties
        if (ag.target) ag.target = new Vector3(ag.target[0], ag.target[1], ag.target[2]);
        if (ag.heading) ag.heading = new Vector3(ag.heading[0], ag.heading[1], ag.heading[2]);
        else ag.heading = new Vector3(0,0,1);
        ag.trail = []; 

        spawnAgent(
            new Vector3(a.position[0], a.position[1], a.position[2]),
            ag.genes,
            ag.energy,
            ag.name,
            ag,
            a.id
        );
    });

    // 4. Restore Food
    data.entities.food.forEach(f => {
        spawnFood(
            new Vector3(f.position[0], f.position[1], f.position[2]),
            f.value,
            f.id
        );
    });
};