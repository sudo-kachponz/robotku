import * as THREE from 'three';
import { Simulator, ROBOT_LINEAR_RADIUS, ROBOT_TURNING_RADIUS} from './simulator';

interface LevelObject {
  type: 'circle' | 'rectangle';
  position: THREE.Vector2;
  radius?: number;
  width?: number;
  height?: number;
}

interface LoopFrame {
    type: 'finite' | 'infinite';
    startIndex: number;
    iterationsLeft?: number;
}

interface Checkpoint {
    type?: 'circle' | 'rectangle';
    position: { x: number; y: number };
    radius?: number;
    width?: number;
    height?: number;
}

interface LevelData {
    id: number;
    name: string;
    difficulty: 'easy' | 'medium' | 'hard';
    description: string;
    environment: {
        start: { position: { x: number; y: number }; rotation: number };
        checkpoints: Checkpoint[];
        obstacles: Array<{
            type: string;
            position: { x: number; y: number };
            radius: number;
            isWall?: boolean;
        }>;
        randomizeObstacles?: {
            tags: string[];
            offsetY: { min: number; max: number };
        };
    };
    constraints?: {
        allowedBlocks?: string[];
    };
    stars: Array<{
        type: string;
        value?: number;
        label: string;
    }>;
}

interface ChallengeMetrics {
    startTime: number;
    endTime: number;
    collisionCount: number;
    attemptNumber: number;
    completed: boolean;
    finalDistance?: number;
}

const MAX_SENSOR_RANGE = 5.0;
const SENSOR_WIDTH_OFFSET = 0.25;

export class SimulatorSequencer {
    private simulator: Simulator;
    private isRunning: boolean = false;
    private stopRequested: boolean = false;
    public virtualPosition: THREE.Vector2 = new THREE.Vector2(0, 0);
    private levelObjects: LevelObject[] = [];
    private lastCollisionLogTime: number = 0;
    private lastCollisionNotificationTime: number = 0;
    private readonly COLLISION_LOG_THROTTLE_MS = 500;
    private readonly COLLISION_NOTIFICATION_THROTTLE_MS = 500;
    private notificationElement: HTMLDivElement | null = null;

    // Challenge Mode properties
    private currentLevel: LevelData | null = null;
    private challengeMetrics: ChallengeMetrics | null = null;
    private isChallengeMode: boolean = false;
    private currentCheckpointIndex: number = 0;
    private checkpointReachedFlags: boolean[] = [];

    // --- Lifecycle & Public Control API ---
    constructor(simulator: Simulator) {
        this.simulator = simulator;
        this.setupEnvironment();
        this.createNotificationElement();
    }

    private createNotificationElement(): void {
        const simulatorContainer = document.getElementById('simulator-container');
        if (!simulatorContainer) return;

        this.notificationElement = document.createElement('div');
        this.notificationElement.id = 'collision-notification';
        this.notificationElement.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(255, 87, 34, 0.95);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            display: none;
            align-items: center;
            gap: 8px;
        `;
        simulatorContainer.appendChild(this.notificationElement);
    }

    private showCollisionNotification(message: string): void {
        if (!this.notificationElement) return;

        // Throttle notifications to prevent spam in forever loops
        const now = performance.now();
        if (now - this.lastCollisionNotificationTime < this.COLLISION_NOTIFICATION_THROTTLE_MS) {
            return; // Skip this notification, too soon since last one
        }
        this.lastCollisionNotificationTime = now;

        this.notificationElement.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>${message}</span>
        `;
        this.notificationElement.style.display = 'flex';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (this.notificationElement) {
                this.notificationElement.style.display = 'none';
            }
        }, 3000);
    }

    public async runCommandSequence(commands: any[]): Promise<void> {
        if (this.isRunning) { return; }
        this.isRunning = true;
        this.stopRequested = false;
        
        let pc = 0;
        const loopStack: LoopFrame[] = [];

        console.log("--- Starting Simulation Interpreter ---");

        let lastWinCheck = 0;
        const winCheckInterval = 100;

        try {
            while (pc < commands.length && !this.stopRequested) {
                if (this.isChallengeMode) {
                    const now = performance.now();
                    if (now - lastWinCheck > winCheckInterval) {
                        if (this.checkWinCondition()) {
                            console.log("🎉 Level completed!");
                            this.stopRequested = true;
                            break;
                        }
                        lastWinCheck = now;
                    }
                }
                const command = commands[pc];
                const commandName = command.command;

                let pcIncrement = 1;

                switch (commandName) {
                    // --- Standard Commands ---
                    case 'MOVE_TIMED':
                    case 'TURN_TIMED':
                    case 'WAIT':
                    case 'SET_HEAD_POSITION':
                    case 'SET_LED_COLOR':
                    case 'DISPLAY_ICON':
                    case 'PLAY_INTERNAL_SOUND': {
                        await this.executeActionCommand(command);
                        break;
                    }

                    // --- Loop Commands ---
                    case 'META_START_LOOP': {
                        loopStack.push({
                            type: 'finite',
                            startIndex: pc + 1,
                            iterationsLeft: command.params.times,
                        });
                        break;
                    }
                    case 'META_START_INFINITE_LOOP': {
                        loopStack.push({
                            type: 'infinite',
                            startIndex: pc + 1,
                        });
                        break;
                    }
                    case 'META_END_LOOP': {
                        if (loopStack.length > 0) {
                            const currentLoop = loopStack[loopStack.length - 1];
                            if (currentLoop.type === 'infinite') {
                                pc = currentLoop.startIndex;
                                pcIncrement = 0;
                            } else if (currentLoop.iterationsLeft! > 1) {
                                currentLoop.iterationsLeft!--;
                                pc = currentLoop.startIndex;
                                pcIncrement = 0;
                            } else {
                                loopStack.pop();
                            }
                        }
                        break;
                    }
                    case 'META_BREAK_LOOP': {
                        if (loopStack.length > 0) {
                            loopStack.pop();
                            pc = this.findMatchingEndLoop(commands, pc);
                        }
                        break;
                    }

                    // --- Conditional Commands ---
                    case 'META_IF':
                    case 'META_ELSE_IF': {
                        const conditionMet = this.evaluateCondition(command.params.condition);
                        if (!conditionMet) {
                            pc = this.findNextBranch(commands, pc);
                        }
                        break;
                    }
                    case 'META_ELSE': {
                        pc = this.findMatchingEndIf(commands, pc);
                        break;
                    }
                }
                pc += pcIncrement;
            }
        } catch (error) { console.error("Error during simulation sequence:", error);
        } finally {
            this.stopAllMovement();
            console.log("--- Simulation Interpreter Finished ---");
            this.isRunning = false;
        }
    }

    public stopSequence(): void {
        if (this.isRunning) { this.stopRequested = true; }
    }

    public resetSimulationState(): void {
        console.log("--- Resetting Simulation State ---");
        this.virtualPosition.set(0, 0);
        if (this.simulator.robotModel) {
            this.simulator.robotModel.rotation.set(0, 0, 0);
        }
    }

    // --- Core Interpreter Action Handlers ---
    private executeActionCommand(command: any): Promise<void> {
        const { command: commandName, params } = command;
        switch(commandName) {
            case 'SET_HEAD_POSITION': this.simulator.setHeadPosition(params.pitch, params.yaw); break;
            case 'SET_LED_COLOR': this.simulator.setLedColor(params.led_id, new THREE.Color(params.r / 255, params.g / 255, params.b / 255)); break;
            case 'DISPLAY_ICON': this.simulator.displayIcon(params.icon_name); break;
            case 'PLAY_INTERNAL_SOUND': this.simulator.playSound(params.sound_id); break;
        }
        if (commandName === 'MOVE_TIMED' || commandName === 'TURN_TIMED' || commandName === 'WAIT') {
            return new Promise(resolve => this.runTimedCommand(command, resolve));
        }
        return Promise.resolve();
    }

    private runTimedCommand(command: any, resolve: () => void): void {
        const { command: commandName, params } = command;
        const robot = this.simulator.robotModel!;
        
        if (commandName === 'TURN_TIMED') {
            const turningClearanceMultiplier = ROBOT_TURNING_RADIUS / ROBOT_LINEAR_RADIUS;
            if (this.isCollisionAt(this.virtualPosition, turningClearanceMultiplier)) {
                console.log("Turn cancelled: Not enough clearance.");
                this.showCollisionNotification("⚠️ Cannot turn - obstacle too close!");
                this.stopAllMovement();
                setTimeout(() => resolve(), 200);
                return;
            }
        }
        
        const startTime = performance.now();
        let lastTime = startTime;
        const duration = params.duration_ms || 0;

        if (commandName === 'WAIT') {
            setTimeout(() => {
                if (this.stopRequested) {
                    this.stopAllMovement();
                }
                resolve();
            }, duration);
            return;
        }

        if (commandName === 'MOVE_TIMED' || commandName === 'TURN_TIMED') {
            const { direction } = params;
            const isTurn = commandName === 'TURN_TIMED';
            this.simulator.playWheelAnimation('L', isTurn ? (direction === 'left' ? 'Backward' : 'Forward') : (direction === 'forward' ? 'Forward' : 'Backward'));
            this.simulator.playWheelAnimation('R', isTurn ? (direction === 'left' ? 'Forward' : 'Backward') : (direction === 'forward' ? 'Forward' : 'Backward'));
        }

        let animationStopped = false;

        const tick = (currentTime: number) => {
            if (animationStopped) return;

            const elapsedTime = currentTime - startTime;
            if (elapsedTime >= duration || this.stopRequested) {
                animationStopped = true;
                this.stopAllMovement();
                return resolve();
            }
            const deltaTime = (currentTime - lastTime) / 1000.0;
            lastTime = currentTime;
            switch (commandName) {
                case 'MOVE_TIMED': {
                    const { direction, speed } = params;
                    const moveSpeed = 0.5 * (speed / 100);
                    const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(robot.quaternion);
                    const distance = moveSpeed * deltaTime;
                    let moveDelta = new THREE.Vector2(forwardVector.x, forwardVector.z).multiplyScalar(distance);
                    if (direction === 'backward') { moveDelta.negate(); }
                    const nextPosition = this.virtualPosition.clone().add(moveDelta);
                    
                    if (!this.isCollisionAt(nextPosition)) {
                        this.virtualPosition.copy(nextPosition);
                    } else {
                        if (this.isChallengeMode && this.currentLevel?.difficulty === 'hard') {
                            this.showCollisionNotification("💥 FAILED! Hard mode - no collisions allowed!");
                            this.stopRequested = true;
                        } else {
                            this.showCollisionNotification("🛑 Movement stopped - obstacle detected!");
                        }
                        animationStopped = true;
                        this.stopAllMovement();
                        return resolve();
                    }
                    break;
                }
                case 'TURN_TIMED': { 
                    const { direction, speed } = params;
                    const turnDirection = direction === 'left' ? 1 : -1;
                    const turnSpeed = 1.0 * (speed / 100);
                    const angleDelta = turnDirection * turnSpeed * deltaTime;
                    robot.rotateY(angleDelta);
                    break;
                }
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    // --- Condition & Sensor Evaluation Helpers ---
    private evaluateCondition(condition: string): boolean {
        const trimmed = condition.trim().toLowerCase();
        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;

        const sandbox = {
            getSensorValue: (commandJson: string): number | null => {
                try {
                    const command = JSON.parse(commandJson);
                    if (command.params && command.params.sensor) {
                        switch(command.params.sensor) {
                            case 'DISTANCE':
                            case 'proximity_front':
                                return this.getDistance();
                        }
                    }
                    return null;
                } catch (e) {
                    return null;
                }
            },
            mathRandomInt: (min: number, max: number): number => {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            }
        };
        try {
            const evaluator = new Function('getSensorValue', 'mathRandomInt', `return ${condition};`);            
            const result = evaluator(sandbox.getSensorValue, sandbox.mathRandomInt);
            return result === true;

        } catch (error) {
            console.error(`Error evaluating condition "${condition}":`, error);
            return false;
        }
    }

    private isCollisionAt(position: THREE.Vector2, clearanceMultiplier: number = 1.0): boolean {
        const effectiveRobotRadius = ROBOT_LINEAR_RADIUS * clearanceMultiplier;

        for (const obj of this.levelObjects) {
            let isHit = false;
            
            if (obj.type === 'circle') {
                const distanceToObstacle = position.distanceTo(obj.position);
                const minimumSafeDistance = effectiveRobotRadius + obj.radius!;
                isHit = distanceToObstacle < minimumSafeDistance;
                
            } else if (obj.type === 'rectangle') {
                isHit = this.checkCircleRectangleCollision(position, effectiveRobotRadius, obj);
            }

            if (isHit) {
                const now = performance.now();
                if (now - this.lastCollisionLogTime > this.COLLISION_LOG_THROTTLE_MS) {
                    console.log(`Collision detected! Effective radius ${effectiveRobotRadius.toFixed(2)}m`);
                    this.lastCollisionLogTime = now;

                    if (this.isChallengeMode && this.challengeMetrics) {
                        this.challengeMetrics.collisionCount++;
                    }
                }
                return true;
            }
        }
        return false;
    }

    private checkCircleRectangleCollision(circlePos: THREE.Vector2, circleRadius: number, rect: LevelObject): boolean {
        const halfWidth = rect.width! / 2;
        const halfHeight = rect.height! / 2;
        
        const closestX = Math.max(rect.position.x - halfWidth, Math.min(circlePos.x, rect.position.x + halfWidth));
        const closestY = Math.max(rect.position.y - halfHeight, Math.min(circlePos.y, rect.position.y + halfHeight));

        const closestPoint = new THREE.Vector2(closestX, closestY);
        
        const distance = circlePos.distanceTo(closestPoint);
        
        return distance < circleRadius;
    }

    private getRayRectangleDistance(rayOrigin: THREE.Vector2, rayDirection: THREE.Vector2, rect: LevelObject): number {
        const halfWidth = rect.width! / 2;
        const halfHeight = rect.height! / 2;
        
        const minX = rect.position.x - halfWidth;
        const maxX = rect.position.x + halfWidth;
        const minY = rect.position.y - halfHeight;
        const maxY = rect.position.y + halfHeight;
        
        let closestT = MAX_SENSOR_RANGE;
        
        const epsilon = 0.0001;
        
        if (Math.abs(rayDirection.x) > epsilon) {
            const tLeft = (minX - rayOrigin.x) / rayDirection.x;
            if (tLeft > 0) {
                const yAtLeft = rayOrigin.y + tLeft * rayDirection.y;
                if (yAtLeft >= minY && yAtLeft <= maxY && tLeft < closestT) {
                    closestT = tLeft;
                }
            }
            
            const tRight = (maxX - rayOrigin.x) / rayDirection.x;
            if (tRight > 0) {
                const yAtRight = rayOrigin.y + tRight * rayDirection.y;
                if (yAtRight >= minY && yAtRight <= maxY && tRight < closestT) {
                    closestT = tRight;
                }
            }
        }
        
        if (Math.abs(rayDirection.y) > epsilon) {
            const tBottom = (minY - rayOrigin.y) / rayDirection.y;
            if (tBottom > 0) {
                const xAtBottom = rayOrigin.x + tBottom * rayDirection.x;
                if (xAtBottom >= minX && xAtBottom <= maxX && tBottom < closestT) {
                    closestT = tBottom;
                }
            }
            
            const tTop = (maxY - rayOrigin.y) / rayDirection.y;
            if (tTop > 0) {
                const xAtTop = rayOrigin.x + tTop * rayDirection.x;
                if (xAtTop >= minX && xAtTop <= maxX && tTop < closestT) {
                    closestT = tTop;
                }
            }
        }
        
        return closestT;
    }

    private getDistance(): number {
        if (!this.simulator.robotModel) return MAX_SENSOR_RANGE;
        const forwardVector = new THREE.Vector2(0, 1).rotateAround(new THREE.Vector2(), -this.simulator.robotModel.rotation.y);
        const rightVector = new THREE.Vector2(1, 0).rotateAround(new THREE.Vector2(), -this.simulator.robotModel.rotation.y);

        const centerRayOrigin = this.virtualPosition.clone();
        const leftRayOrigin = centerRayOrigin.clone().add(rightVector.clone().multiplyScalar(-SENSOR_WIDTH_OFFSET));
        const rightRayOrigin = centerRayOrigin.clone().add(rightVector.clone().multiplyScalar(SENSOR_WIDTH_OFFSET));

        const rayOrigins = [centerRayOrigin, leftRayOrigin, rightRayOrigin];
        let closestDistance = MAX_SENSOR_RANGE;

        for (const rayOrigin of rayOrigins) {
            for (const obj of this.levelObjects) {
                if (obj.type === 'circle') {
                    const L = obj.position.clone().sub(rayOrigin);
                    const tca = L.dot(forwardVector);
                    if (tca < 0) continue;
                    
                    const d2 = L.dot(L) - tca * tca;
                    const r2 = obj.radius! * obj.radius!;
                    if (d2 > r2) continue;
                    
                    const thc = Math.sqrt(r2 - d2);
                    const intersectionDistance = tca - thc;

                    if (intersectionDistance < closestDistance) {
                        closestDistance = intersectionDistance;
                    }
                } else if (obj.type === 'rectangle') {
                    const rectDist = this.getRayRectangleDistance(rayOrigin, forwardVector, obj);
                    if (rectDist < closestDistance) {
                        closestDistance = rectDist;
                    }
                }
            }
        }
        
        const distanceFromBumper = closestDistance - ROBOT_LINEAR_RADIUS;
        
        return Math.max(0, distanceFromBumper);
    }

    // --- Interpreter Program Counter (PC) Jump Helpers ---
    private findNextBranch(commands: any[], startIndex: number): number {
        let nestLevel = 0;
        for (let i = startIndex + 1; i < commands.length; i++) {
            const cmd = commands[i].command;
            if (cmd === 'META_IF') nestLevel++;
            if (cmd === 'META_END_IF') {
                if (nestLevel === 0) return i;
                nestLevel--;
            }
            if (nestLevel === 0 && (cmd === 'META_ELSE_IF' || cmd === 'META_ELSE')) {
                return i;
            }
        }
        return commands.length;
    }
    
    private findMatchingEndIf(commands: any[], startIndex: number): number {
        let nestLevel = 0;
        for (let i = startIndex + 1; i < commands.length; i++) {
            const cmd = commands[i].command;
            if (cmd === 'META_IF') nestLevel++;
            if (cmd === 'META_END_IF') {
                if (nestLevel === 0) return i;
                nestLevel--;
            }
        }
        return commands.length;
    }

    private findMatchingEndLoop(commands: any[], startIndex: number): number {
        let nestLevel = 0;
        for (let i = startIndex + 1; i < commands.length; i++) {
            const cmd = commands[i].command;
            if (cmd === 'META_START_LOOP' || cmd === 'META_START_INFINITE_LOOP') {
                nestLevel++;
            } else if (cmd === 'META_END_LOOP') {
                if (nestLevel === 0) return i;
                nestLevel--;
            }
        }
        return commands.length;
    }

    // --- Challenge Mode Methods ---
    public loadLevel(levelData: LevelData): void {
        console.log(`Loading level: ${levelData.name}`);
        this.currentLevel = levelData;
        this.isChallengeMode = true;

        this.simulator.clearLevel();
        this.levelObjects = [];

        let obstacles = [...levelData.environment.obstacles];
        if (levelData.environment.randomizeObstacles) {
            const randomizeConfig = levelData.environment.randomizeObstacles;
            obstacles = obstacles.map(obs => {
                const hasTag = randomizeConfig.tags.some(tag => 
                    (obs as any)[tag] === true
                );
                if (hasTag) {
                    const offsetY = 
                        randomizeConfig.offsetY.min + 
                        Math.random() * (randomizeConfig.offsetY.max - randomizeConfig.offsetY.min);
                    return {
                        ...obs,
                        position: {
                            x: obs.position.x,
                            y: obs.position.y + offsetY
                        }
                    };
                }
                return obs;
            });
        }

        obstacles.forEach(obstacle => {
            this.addLevelObject(obstacle);
        });

        const checkpoints = levelData.environment.checkpoints;
        this.currentCheckpointIndex = 0;
        this.checkpointReachedFlags = new Array(checkpoints.length).fill(false);

        if (checkpoints.length > 0) {
            this.simulator.addFinishZone(checkpoints[0]);
        }

        this.resetLevel();

        console.log(`Level loaded with ${obstacles.length} obstacles and ${checkpoints.length} checkpoint(s)`);
    }

    public resetLevel(): void {
        if (!this.currentLevel) {
            this.resetSimulationState();
            return;
        }

        const startPos = this.currentLevel.environment.start.position;
        const startRot = this.currentLevel.environment.start.rotation;

        this.virtualPosition.set(startPos.x, startPos.y);
        if (this.simulator.robotModel) {
            this.simulator.robotModel.position.set(startPos.x, 0, startPos.y);
            this.simulator.robotModel.rotation.set(0, startRot, 0);
        }

        const checkpoints = this.currentLevel.environment.checkpoints;
        this.currentCheckpointIndex = 0;
        this.checkpointReachedFlags = new Array(checkpoints.length).fill(false);

        if (checkpoints.length > 0) {
            this.simulator.addFinishZone(checkpoints[0]);
        }

        console.log(`Robot reset to start: (${startPos.x}, ${startPos.y}), rotation: ${startRot}`);
    }

    public checkWinCondition(): boolean {
        if (!this.currentLevel) return false;

        const checkpoints = this.currentLevel.environment.checkpoints;
        if (this.currentCheckpointIndex >= checkpoints.length) {
            return true;
        }

        const currentCheckpoint = checkpoints[this.currentCheckpointIndex];
        const checkpointPos = new THREE.Vector2(currentCheckpoint.position.x, currentCheckpoint.position.y);
        const type = currentCheckpoint.type || 'circle';

        let isInCheckpoint = false;

        if (type === 'rectangle') {
            const halfWidth = (currentCheckpoint.width || 1) / 2;
            const halfHeight = (currentCheckpoint.height || 1) / 2;
            
            const dx = Math.abs(this.virtualPosition.x - checkpointPos.x);
            const dy = Math.abs(this.virtualPosition.y - checkpointPos.y);
            
            isInCheckpoint = dx <= halfWidth && dy <= halfHeight;

        } else {
            const distance = this.virtualPosition.distanceTo(checkpointPos);
            isInCheckpoint = distance <= (currentCheckpoint.radius || 0.6);
        }

        if (isInCheckpoint && !this.checkpointReachedFlags[this.currentCheckpointIndex]) {
            this.checkpointReachedFlags[this.currentCheckpointIndex] = true;
            this.currentCheckpointIndex++;

            console.log(`✓ Checkpoint ${this.currentCheckpointIndex}/${checkpoints.length} reached!`);

            if (this.currentCheckpointIndex < checkpoints.length) {
                this.simulator.addFinishZone(checkpoints[this.currentCheckpointIndex]);
                console.log(`→ Next checkpoint loaded at (${checkpoints[this.currentCheckpointIndex].position.x}, ${checkpoints[this.currentCheckpointIndex].position.y})`);
                return false;
            } else {
                console.log(`✓ All ${checkpoints.length} checkpoints reached! Level complete!`);
                return true;
            }
        }

        return false;
    }

    public getChallengeMetrics(): ChallengeMetrics | null {
        return this.challengeMetrics;
    }

    public startChallengeRun(attemptNumber: number): void {
        this.challengeMetrics = {
            startTime: performance.now(),
            endTime: 0,
            collisionCount: 0,
            attemptNumber: attemptNumber,
            completed: false,
            finalDistance: undefined
        };
        console.log(`Challenge run started - Attempt #${attemptNumber}`);
    }

    public endChallengeRun(completed: boolean): void {
        if (!this.challengeMetrics) return;

        this.challengeMetrics.endTime = performance.now();
        this.challengeMetrics.completed = completed;

        if (this.currentLevel) {
            const checkpoints = this.currentLevel.environment.checkpoints;
            if (checkpoints.length > 0) {
                const finalCheckpoint = checkpoints[checkpoints.length - 1];
                const finalPos = new THREE.Vector2(finalCheckpoint.position.x, finalCheckpoint.position.y);
                this.challengeMetrics.finalDistance = this.virtualPosition.distanceTo(finalPos);
            }
        }

        const elapsedMs = this.challengeMetrics.endTime - this.challengeMetrics.startTime;
        console.log(`Challenge run ended - Completed: ${completed}, Time: ${(elapsedMs / 1000).toFixed(2)}s, Collisions: ${this.challengeMetrics.collisionCount}`);
    }

    public exitChallengeMode(): void {
        this.isChallengeMode = false;
        this.currentLevel = null;
        this.challengeMetrics = null;
        this.simulator.clearFinishZone();
        this.setupEnvironment();
        console.log('Exited challenge mode, restored sandbox environment');
    }

    // --- Environment & General Helpers ---
    private setupEnvironment(): void {
        this.simulator.clearLevel();
        this.simulator.clearFinishZone();
        this.levelObjects = [];
        
        this.addLevelObject({ type: 'circle', position: { x: 0, y: 3 }, radius: 0.5 });
        this.addLevelObject({ type: 'circle', position: { x: 0, y: -3 }, radius: 0.5 });
        this.addLevelObject({ type: 'circle', position: { x: 2, y: 5 }, radius: 0.7 });
        this.addLevelObject({ type: 'circle', position: { x: -4, y: 4 }, radius: 1.0 });
    }

    private addLevelObject(objData: any): void {
        const position = new THREE.Vector2(objData.position.x, objData.position.y);
        
        if (objData.type === 'circle') {
            this.levelObjects.push({
                type: 'circle',
                position,
                radius: objData.radius
            });
        } else if (objData.type === 'rectangle') {
            this.levelObjects.push({
                type: 'rectangle',
                position,
                width: objData.width,
                height: objData.height
            });
        }
        
        this.simulator.addLevelObject(objData);
    }

    private stopAllMovement(): void {
        this.simulator.stopWheelAnimation('L');
        this.simulator.stopWheelAnimation('R');
        this.simulator.stopWheelAnimation('B');
    }
}