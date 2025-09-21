// Класс для управления UI
class PhysicsUI {
    constructor(physics, renderer) {
        this.physics = physics;
        this.renderer = renderer;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Кнопки
        document.getElementById('toggleWireframe').addEventListener('click', () => {
            this.renderer.wireframeMode = !this.renderer.wireframeMode;
            this.updateWireframeButton();
        });
        
        // Ползунки
        this.setupSlider('gravitySlider', 'gravityValue', (value) => {
            this.physics.setGravityStrength(value);
        });
        
        this.setupSlider('windSlider', 'windValue', (value) => {
            this.physics.setWindStrength(value);
        });
        
        this.setupSlider('stretchSlider', 'stretchValue', (value) => {
            this.physics.setStretchStiffness(value);
        });
        
        this.setupSlider('bendSlider', 'bendValue', (value) => {
            this.physics.setBendStiffness(value);
        });
        
        this.setupSlider('dampingSlider', 'dampingValue', (value) => {
            this.physics.setDamping(value);
        });
        
        this.setupSlider('airResistanceSlider', 'airResistanceValue', (value) => {
            this.physics.setAirResistance(value);
        });
        
        this.setupSlider('iterationsSlider', 'iterationsValue', (value) => {
            this.physics.setIterations(value);
        });
        
        // Движение центральной вершины
        document.getElementById('centerMotionToggle').addEventListener('change', (event) => {
            this.physics.setCenterVertexMotion(event.target.checked);
        });
        
        this.setupSlider('centerAmplitudeSlider', 'centerAmplitudeValue', (value) => {
            this.physics.setCenterVertexAmplitude(value);
        });
        
        this.setupSlider('centerFrequencySlider', 'centerFrequencyValue', (value) => {
            this.physics.setCenterVertexFrequency(value);
        });
        
        // Направление силы
        const forceInputs = ['forceX', 'forceY', 'forceZ'];
        forceInputs.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                const x = parseFloat(document.getElementById('forceX').value) || 0;
                const y = parseFloat(document.getElementById('forceY').value) || 0;
                const z = parseFloat(document.getElementById('forceZ').value) || 0;
                this.physics.setWindDirection(x, y, z);
            });
        });
    }
    
    setupSlider(sliderId, valueId, callback) {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);
        
        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            valueDisplay.textContent = value.toFixed(3);
            callback(value);
        });
    }
    
    updateWireframeButton() {
        const button = document.getElementById('toggleWireframe');
        button.textContent = this.renderer.wireframeMode ? 'Triangles' : 'Wireframe';
    }
}

// Класс для XPBD физики ткани
class XPBDPhysics {
    constructor() {
        this.particles = [];
        this.constraints = [];
        this.dt = 1/60; // Временной шаг
        this.iterations = 4; // Количество итераций решателя
        this.gravity = new Vec3(0, -9.81, 0);
        
        // Параметры материала
        this.stretchStiffness = 1.0;
        this.bendStiffness = 0.001;
        this.damping = 0.99;
        
        // Дополнительные параметры
        this.gravityStrength = 9.81;
        this.airResistance = 0.01;
        this.windStrength = 0.0;
        this.windDirection = new Vec3(1, 0, 0);
        
        // Параметры для движения центральной вершины
        this.centerVertexMotion = true;
        this.centerVertexAmplitude = 0.3;
        this.centerVertexFrequency = 8.0;
        this.centerVertexIndex = -1; // Будет установлен в initFromGeometry
        this.time = 0.0; // Время для синусоидального движения
    }
    
    initFromGeometry(geometry) {
        const vertexCount = geometry.vertexCount;
        this.particles = [];
        
        // Инициализируем частицы
        for (let i = 0; i < vertexCount; i++) {
            const vertexIndex = i * 3;
            const particle = {
                position: new Vec3(
                    geometry.vertices[vertexIndex],
                    geometry.vertices[vertexIndex + 1],
                    geometry.vertices[vertexIndex + 2]
                ),
                prevPosition: new Vec3(
                    geometry.vertices[vertexIndex],
                    geometry.vertices[vertexIndex + 1],
                    geometry.vertices[vertexIndex + 2]
                ),
                velocity: new Vec3(0, 0, 0),
                mass: 1.0,
                invMass: 1.0,
                isFixed: false
            };
            
            // Фиксируем все углы ткани
            const segmentsX = 20; // Должно соответствовать GridGeometry
            const segmentsY = 20;
            const x = i % (segmentsX + 1);
            const y = Math.floor(i / (segmentsX + 1));
            
            // Закрепляем все четыре угла
            if ((x === 0 && y === 0) ||           // Левый верхний
                (x === segmentsX && y === 0) ||   // Правый верхний
                (x === 0 && y === segmentsY) ||   // Левый нижний
                (x === segmentsX && y === segmentsY)) { // Правый нижний
                particle.isFixed = true;
                particle.invMass = 0.0;
            }
            
            this.particles.push(particle);
        }
        
        // Находим центральную вершину
        const segmentsX = 20;
        const segmentsY = 20;
        const centerX = Math.floor(segmentsX / 2);
        const centerY = Math.floor(segmentsY / 2);
        this.centerVertexIndex = centerY * (segmentsX + 1) + centerX;
        
        this.createConstraints(geometry);
        console.log(`XPBD инициализирован: ${this.particles.length} частиц, ${this.constraints.length} ограничений`);
        console.log(`Центральная вершина: индекс ${this.centerVertexIndex}, движение ${this.centerVertexMotion ? 'включено' : 'выключено'}`);
    }
    
    createConstraints(geometry) {
        this.constraints = [];
        const segmentsX = 20;
        const segmentsY = 20;
        
        // Создаем ограничения на растяжение (связи между соседними вершинами)
        for (let y = 0; y <= segmentsY; y++) {
            for (let x = 0; x <= segmentsX; x++) {
                const i = y * (segmentsX + 1) + x;
                
                // Горизонтальные связи
                if (x < segmentsX) {
                    const j = i + 1;
                    this.addStretchConstraint(i, j);
                }
                
                // Вертикальные связи
                if (y < segmentsY) {
                    const j = i + (segmentsX + 1);
                    this.addStretchConstraint(i, j);
                }
                
                // Диагональные связи
                if (x < segmentsX && y < segmentsY) {
                    const j = i + (segmentsX + 1) + 1;
                    this.addStretchConstraint(i, j);
                }
            }
        }
        
        // Создаем ограничения на изгиб (для смежных треугольников)
        for (let y = 0; y < segmentsY; y++) {
            for (let x = 0; x < segmentsX; x++) {
                const i = y * (segmentsX + 1) + x;
                
                // Изгиб по горизонтали
                if (x < segmentsX - 1) {
                    const j = i + 1;
                    const k = i + 2;
                    this.addBendConstraint(i, j, k);
                }
                
                // Изгиб по вертикали
                if (y < segmentsY - 1) {
                    const j = i + (segmentsX + 1);
                    const k = i + 2 * (segmentsX + 1);
                    this.addBendConstraint(i, j, k);
                }
            }
        }
    }
    
    addStretchConstraint(i, j) {
        const p1 = this.particles[i].position;
        const p2 = this.particles[j].position;
        const restLength = Vec3.subtract(p2, p1);
        const length = Math.sqrt(restLength.x * restLength.x + restLength.y * restLength.y + restLength.z * restLength.z);
        
        this.constraints.push({
            type: 'stretch',
            particles: [i, j],
            restLength: length,
            stiffness: this.stretchStiffness
        });
    }
    
    addBendConstraint(i, j, k) {
        this.constraints.push({
            type: 'bend',
            particles: [i, j, k],
            stiffness: this.bendStiffness
        });
    }
    
    update(deltaTime) {
        if (deltaTime <= 0) return;
        
        // Обновляем время для синусоидального движения
        this.time += deltaTime;
        
        // Обновляем временной шаг
        this.dt = deltaTime;
        
        // Обновляем гравитацию
        this.gravity.y = -this.gravityStrength;
        
        // Применяем силы и обновляем скорости
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.isFixed) continue;
            
            // Сохраняем предыдущую позицию
            p.prevPosition = new Vec3(p.position.x, p.position.y, p.position.z);
            
            // Применяем гравитацию
            p.velocity.x += this.gravity.x * this.dt;
            p.velocity.y += this.gravity.y * this.dt;
            p.velocity.z += this.gravity.z * this.dt;
            
            // Применяем ветер
            if (this.windStrength > 0) {
                p.velocity.x += this.windDirection.x * this.windStrength * this.dt;
                p.velocity.y += this.windDirection.y * this.windStrength * this.dt;
                p.velocity.z += this.windDirection.z * this.windStrength * this.dt;
            }
            
            // Применяем сопротивление воздуха
            const airDamping = 1.0 - this.airResistance * this.dt;
            p.velocity.x *= airDamping;
            p.velocity.y *= airDamping;
            p.velocity.z *= airDamping;
            
            // Применяем общее демпфирование
            p.velocity.x *= this.damping;
            p.velocity.y *= this.damping;
            p.velocity.z *= this.damping;
            
            // Обновляем позицию
            p.position.x += p.velocity.x * this.dt;
            p.position.y += p.velocity.y * this.dt;
            p.position.z += p.velocity.z * this.dt;
        }
        
        // Применяем синусоидальное движение к центральной вершине
        if (this.centerVertexMotion && this.centerVertexIndex >= 0 && this.centerVertexIndex < this.particles.length) {
            const centerParticle = this.particles[this.centerVertexIndex];
            const originalY = 0; // Исходная Y координата центральной вершины
            const sineOffset = Math.sin(this.time * this.centerVertexFrequency) * this.centerVertexAmplitude;
            centerParticle.position.y = originalY + sineOffset;
        }
        
        // Решаем ограничения
        for (let iter = 0; iter < this.iterations; iter++) {
            this.solveConstraints();
        }
        
        // Обновляем скорости на основе новых позиций
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.isFixed) continue;
            
            p.velocity.x = (p.position.x - p.prevPosition.x) / this.dt;
            p.velocity.y = (p.position.y - p.prevPosition.y) / this.dt;
            p.velocity.z = (p.position.z - p.prevPosition.z) / this.dt;
        }
    }
    
    solveConstraints() {
        for (let i = 0; i < this.constraints.length; i++) {
            const constraint = this.constraints[i];
            
            if (constraint.type === 'stretch') {
                this.solveStretchConstraint(constraint);
            } else if (constraint.type === 'bend') {
                this.solveBendConstraint(constraint);
            }
        }
    }
    
    solveStretchConstraint(constraint) {
        const [i, j] = constraint.particles;
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        
        const dx = p2.position.x - p1.position.x;
        const dy = p2.position.y - p1.position.y;
        const dz = p2.position.z - p1.position.z;
        
        const currentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (currentLength === 0) return;
        
        const error = currentLength - constraint.restLength;
        const invMass1 = p1.invMass;
        const invMass2 = p2.invMass;
        const totalInvMass = invMass1 + invMass2;
        
        if (totalInvMass === 0) return;
        
        const lambda = -error / (totalInvMass * constraint.stiffness);
        
        const correctionX = lambda * dx / currentLength;
        const correctionY = lambda * dy / currentLength;
        const correctionZ = lambda * dz / currentLength;
        
        if (!p1.isFixed) {
            p1.position.x -= correctionX * invMass1;
            p1.position.y -= correctionY * invMass1;
            p1.position.z -= correctionZ * invMass1;
        }
        
        if (!p2.isFixed) {
            p2.position.x += correctionX * invMass2;
            p2.position.y += correctionY * invMass2;
            p2.position.z += correctionZ * invMass2;
        }
    }
    
    solveBendConstraint(constraint) {
        // Упрощенная реализация ограничения на изгиб
        const [i, j, k] = constraint.particles;
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        const p3 = this.particles[k];
        
        // Вычисляем нормали к плоскостям
        const v1 = Vec3.subtract(p2.position, p1.position);
        const v2 = Vec3.subtract(p3.position, p1.position);
        const normal = Vec3.cross(v1, v2);
        const normalLength = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
        
        if (normalLength < 1e-6) return;
        
        // Нормализуем
        normal.x /= normalLength;
        normal.y /= normalLength;
        normal.z /= normalLength;
        
        // Применяем небольшое ограничение на изгиб
        const bendStrength = 0.1 * constraint.stiffness;
        
        if (!p1.isFixed) {
            p1.position.x += normal.x * bendStrength * 0.01;
            p1.position.y += normal.y * bendStrength * 0.01;
            p1.position.z += normal.z * bendStrength * 0.01;
        }
    }
    
    getParticleData() {
        const data = new Float32Array(this.particles.length * 6);
        
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const index = i * 6;
            
            data[index + 0] = p.position.x;
            data[index + 1] = p.position.y;
            data[index + 2] = p.position.z;
            data[index + 3] = p.velocity.x;
            data[index + 4] = p.velocity.y;
            data[index + 5] = p.velocity.z;
        }
        
        return data;
    }
    
    // Методы для обновления параметров
    setGravityStrength(value) {
        this.gravityStrength = Math.max(0, value);
    }
    
    setStretchStiffness(value) {
        this.stretchStiffness = Math.max(0.6, Math.min(2.0, value));
        // Обновляем жесткость в существующих ограничениях
        for (let i = 0; i < this.constraints.length; i++) {
            if (this.constraints[i].type === 'stretch') {
                this.constraints[i].stiffness = this.stretchStiffness;
            }
        }
    }
    
    setBendStiffness(value) {
        this.bendStiffness = Math.max(0.001, Math.min(0.1, value));
        // Обновляем жесткость в существующих ограничениях
        for (let i = 0; i < this.constraints.length; i++) {
            if (this.constraints[i].type === 'bend') {
                this.constraints[i].stiffness = this.bendStiffness;
            }
        }
    }
    
    setDamping(value) {
        this.damping = Math.max(0.1, Math.min(1.0, value));
    }
    
    setIterations(value) {
        this.iterations = Math.max(1, Math.min(20, Math.floor(value)));
    }
    
    setAirResistance(value) {
        this.airResistance = Math.max(0.0, Math.min(0.1, value));
    }
    
    setWindStrength(value) {
        this.windStrength = Math.max(0.0, Math.min(50.0, value));
    }
    
    setWindDirection(x, y, z) {
        const length = Math.sqrt(x*x + y*y + z*z);
        if (length > 0) {
            this.windDirection.x = x / length;
            this.windDirection.y = y / length;
            this.windDirection.z = z / length;
        }
    }
    
    // Методы для управления движением центральной вершины
    setCenterVertexMotion(enabled) {
        this.centerVertexMotion = enabled;
    }
    
    setCenterVertexAmplitude(value) {
        this.centerVertexAmplitude = Math.max(0.0, Math.min(5.0, value));
    }
    
    setCenterVertexFrequency(value) {
        this.centerVertexFrequency = Math.max(0.1, Math.min(10.0, value));
    }
    
    // Сброс к начальному состоянию
    reset() {
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.velocity.x = 0;
            p.velocity.y = 0;
            p.velocity.z = 0;
        }
    }
}

class WebGPURenderer {
    constructor() {
        this.canvas = null;
        this.device = null;
        this.context = null;
        this.renderPipeline = null;
        this.trianglePipeline = null;
        this.indexBuffer = null;
        this.wireframeIndexBuffer = null;
        this.uniformBuffer = null;
        this.bindGroup = null;
        this.depthTexture = null;
        this.gridGeometry = null;
        
        // Compute shader для симуляции
        this.computePipeline = null;
        this.computeBindGroup = null;
        this.positionBuffer = null; 
        this.timeBuffer = null;
        this.wireframeMode = true; // По умолчанию показываем wireframe
        
        // XPBD физика
        this.physics = new XPBDPhysics();
        this.ui = null; // UI будет инициализирован после создания physics
        
        // 3D камера и управление
        this.camera = new Camera();
        this.projectionMatrix = null;
        this.modelMatrix = Mat4.identity();
        
        // Управление
        this.keys = {};
        this.mouse = { x: 0, y: 0, locked: false };
        this.lastTime = 0;
    }

    async init() {
        this.canvas = document.getElementById('canvas');
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }

        if (!navigator.gpu) {
            throw new Error('WebGPU не поддерживается в этом браузере');
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('Не удалось получить WebGPU адаптер');
        }

        this.device = await adapter.requestDevice();
        
        this.device.addEventListener('uncapturederror', (event) => {
            console.error('WebGPU error:', event.error);
        });
        
        this.context = this.canvas.getContext('webgpu');
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        
        this.context.configure({
            device: this.device,
            format: canvasFormat,
        });

        const aspect = this.canvas.width / this.canvas.height;
        this.projectionMatrix = Mat4.perspective(45 * Math.PI / 180, aspect, 0.1, 100.0);
        
        await this.createShaders();
        await this.createComputeShader();
        
        this.gridGeometry = GridGeometry.createPlane(10, 10, 20, 20);
        
        // Инициализируем XPBD физику
        this.physics.initFromGeometry(this.gridGeometry);
        
        // Инициализируем UI
        this.ui = new PhysicsUI(this.physics, this);
        
        // Создаем буферы в правильном порядке
        this.createComputeBuffers(); // Сначала создаем position buffer
        this.createIndexBuffer();
        this.createWireframeIndexBuffer();
        this.createUniformBuffer();
        this.createDepthTexture();
        
        this.setupControls();
        
        console.log('WebGPU инициализирован успешно');
        console.log(`Создано ${this.gridGeometry.vertexCount} вершин`);
        console.log(`Wireframe индексов: ${this.gridGeometry.wireframeIndexCount}`);
        console.log(`Triangle индексов: ${this.gridGeometry.indexCount}`);
        console.log('Управление:');
        console.log('  WASD - движение камеры');
        console.log('  Space/Shift - вверх/вниз');
        console.log('  Мышь - поворот камеры');
        console.log('  T - переключение wireframe/triangles');
        console.log('  Все остальные настройки доступны через UI панель справа');
    }

    async createShaders() {
        const vertexShaderCode = `
            struct Uniforms {
                modelMatrix: mat4x4<f32>,
                viewMatrix: mat4x4<f32>,
                projectionMatrix: mat4x4<f32>,
            }
            
            @group(0) @binding(0) var<uniform> uniforms: Uniforms;
            
            @vertex
            fn vs_main(@location(0) position: vec3<f32>, @location(1) velocity: vec3<f32>) -> @builtin(position) vec4<f32> {
                let worldPos = uniforms.modelMatrix * vec4<f32>(position, 1.0);
                let viewPos = uniforms.viewMatrix * worldPos;
                let clipPos = uniforms.projectionMatrix * viewPos;
                return clipPos;
            }
        `;

        const fragmentShaderCode = `
            @fragment
            fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
                return vec4<f32>(0.2, 0.5, 0.8, 0.7); // Полупрозрачный синий для треугольников
            }
        `;

        const vertexShaderModule = this.device.createShaderModule({
            code: vertexShaderCode,
        });

        const fragmentShaderModule = this.device.createShaderModule({
            code: fragmentShaderCode,
        });

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: 'uniform',
                },
            }],
        });

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        const vertexState = {
            module: vertexShaderModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 6 * 4, // 6 float32 (position + velocity) * 4 bytes
                attributes: [
                    {
                        format: 'float32x3',
                        offset: 0,
                        shaderLocation: 0, // position
                    },
                    {
                        format: 'float32x3',
                        offset: 3 * 4,
                        shaderLocation: 1, // velocity
                    }
                ],
            }],
        };

        const fragmentState = {
            module: fragmentShaderModule,
            entryPoint: 'fs_main',
            targets: [{
                format: navigator.gpu.getPreferredCanvasFormat(),
                blend: {
                    color: {
                        srcFactor: 'src-alpha',
                        dstFactor: 'one-minus-src-alpha',
                        operation: 'add',
                    },
                    alpha: {
                        srcFactor: 'one',
                        dstFactor: 'one-minus-src-alpha',
                        operation: 'add',
                    },
                },
            }],
        };

        const depthStencil = {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        };

        // Wireframe pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: vertexState,
            fragment: fragmentState,
            primitive: {
                topology: 'line-list',
                cullMode: 'none',
            },
            depthStencil: depthStencil,
        });

        // Triangle pipeline
        this.trianglePipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: vertexState,
            fragment: fragmentState,
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none',
            },
            depthStencil: depthStencil,
        });

        this.bindGroupLayout = bindGroupLayout;
    }

    async createComputeShader() {
        const computeShaderCode = `
            // Работаем с плоским массивом данных: [x, y, z, vx, vy, vz, x, y, z, vx, vy, vz, ...]
            @group(0) @binding(0) var<storage, read_write> particleData: array<f32>;
            @group(0) @binding(1) var<uniform> time: f32;
            
            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                let particleIndex = global_id.x;
                let dataIndex = particleIndex * 6; // 6 элементов на частицу (pos + vel)
                
                if (dataIndex + 5 >= arrayLength(&particleData)) {
                    return;
                }
                
                // Получаем исходные координаты
                let x = particleData[dataIndex + 0];
                let y = particleData[dataIndex + 1];
                let z = particleData[dataIndex + 2];
                
                // Создаем волну на основе расстояния от центра
                let distance = sqrt(x * x + z * z);
                let wave = sin(time * 2.0 + distance * 0.5) * 0.5;
                
                // Обновляем только Y координату, сохраняя X и Z
                particleData[dataIndex + 1] = wave;
                
                // Скорость остается нулевой (уже инициализирована)
                // particleData[dataIndex + 3] = 0; // vx
                // particleData[dataIndex + 4] = 0; // vy  
                // particleData[dataIndex + 5] = 0; // vz
            }
        `;

        const computeShaderModule = this.device.createShaderModule({
            code: computeShaderCode,
        });

        const computeBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'uniform',
                    },
                },
            ],
        });

        this.computePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [computeBindGroupLayout],
            }),
            compute: {
                module: computeShaderModule,
                entryPoint: 'main',
            },
        });

        this.computeBindGroupLayout = computeBindGroupLayout;
    }

    createComputeBuffers() {
        const vertexCount = this.gridGeometry.vertexCount;
        console.log(`Создаем compute буферы для ${vertexCount} вершин`);
        
        // Создаем единый буфер для позиций и скоростей
        const particleBufferSize = vertexCount * 6 * 4; // 6 * sizeof(f32) на вершину
        console.log(`Размер particle буфера: ${particleBufferSize} байт`);
        
        this.positionBuffer = this.device.createBuffer({
            size: particleBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        // Инициализируем данные частиц из исходной геометрии
        const particleData = new Float32Array(vertexCount * 6);
        const originalVertices = this.gridGeometry.vertices;
        
        console.log(`Исходных вершин в геометрии: ${originalVertices.length / 3}`);
        console.log(`Ожидаемое количество частиц: ${vertexCount}`);
        
        for (let i = 0; i < vertexCount; i++) {
            const particleIndex = i * 6;
            const vertexIndex = i * 3;
            
            // Копируем исходную позицию
            particleData[particleIndex + 0] = originalVertices[vertexIndex + 0]; // x
            particleData[particleIndex + 1] = originalVertices[vertexIndex + 1]; // y  
            particleData[particleIndex + 2] = originalVertices[vertexIndex + 2]; // z
            
            // Инициализируем скорость нулями
            particleData[particleIndex + 3] = 0; // vx
            particleData[particleIndex + 4] = 0; // vy
            particleData[particleIndex + 5] = 0; // vz
            
            // Логируем первые несколько вершин
            if (i < 5) {
                console.log(`Вершина ${i}: pos(${particleData[particleIndex]}, ${particleData[particleIndex + 1]}, ${particleData[particleIndex + 2]}) vel(${particleData[particleIndex + 3]}, ${particleData[particleIndex + 4]}, ${particleData[particleIndex + 5]})`);
            }
        }
        
        console.log(`Инициализировано ${vertexCount} частиц в буфере размером ${particleData.length} элементов`);
        
        this.device.queue.writeBuffer(this.positionBuffer, 0, particleData);
        console.log('Particle данные записаны в буфер');

        // Создаем uniform buffer для времени
        this.timeBuffer = this.device.createBuffer({
            size: 4, // sizeof(f32)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Создаем bind group для compute shader
        this.computeBindGroup = this.device.createBindGroup({
            layout: this.computeBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.positionBuffer,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.timeBuffer,
                    },
                },
            ],
        });
        
        console.log('Compute bind group создан');
    }

    createIndexBuffer() {
        const indices = this.gridGeometry.indices;

        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.indexBuffer, 0, indices);
    }

    createWireframeIndexBuffer() {
        const wireframeIndices = this.gridGeometry.wireframeIndices;
        
        // Проверяем, что все индексы корректны
        const maxIndex = this.gridGeometry.vertexCount - 1;
        for (let i = 0; i < wireframeIndices.length; i++) {
            if (wireframeIndices[i] > maxIndex) {
                console.error(`Неверный индекс ${wireframeIndices[i]} на позиции ${i}, максимальный индекс: ${maxIndex}`);
            }
        }

        this.wireframeIndexBuffer = this.device.createBuffer({
            size: wireframeIndices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.wireframeIndexBuffer, 0, wireframeIndices);
        
        console.log(`Wireframe буфер создан с ${wireframeIndices.length} индексами`);
    }

    createUniformBuffer() {
        const uniformBufferSize = 3 * 16 * 4; // 3 * mat4x4<f32> * sizeof(f32)
        
        this.uniformBuffer = this.device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.uniformBuffer,
                },
            }],
        });
    }

    createDepthTexture() {
        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    setupControls() {
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            // Быстрые клавиши для основных функций
            if (event.code === 'KeyT') {
                this.wireframeMode = !this.wireframeMode;
                if (this.ui) this.ui.updateWireframeButton();
            }
        });

        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });

        this.canvas.addEventListener('click', () => {
            this.canvas.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.mouse.locked = document.pointerLockElement === this.canvas;
        });

        document.addEventListener('mousemove', (event) => {
            if (this.mouse.locked) {
                const xoffset = event.movementX;
                const yoffset = -event.movementY;
                this.camera.processMouseMovement(xoffset, yoffset);
            }
        });
    }

    updateCamera(deltaTime) {
        if (this.keys['KeyW']) this.camera.processKeyboard('FORWARD', deltaTime);
        if (this.keys['KeyS']) this.camera.processKeyboard('BACKWARD', deltaTime);
        if (this.keys['KeyA']) this.camera.processKeyboard('LEFT', deltaTime);
        if (this.keys['KeyD']) this.camera.processKeyboard('RIGHT', deltaTime);
        if (this.keys['Space']) this.camera.processKeyboard('UP', deltaTime);
        if (this.keys['ShiftLeft']) this.camera.processKeyboard('DOWN', deltaTime);
    }

    updateUniforms() {
        const viewMatrix = this.camera.getViewMatrix();
        
        const uniformData = new Float32Array(3 * 16);
        
        const modelMatrix = Mat4.identity();
        uniformData.set(modelMatrix.elements, 0);
        uniformData.set(viewMatrix.elements, 16);
        uniformData.set(this.projectionMatrix.elements, 32);
        
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }


    render(currentTime) {
        const deltaTime = this.lastTime ? (currentTime - this.lastTime) / 1000 : 0;
        this.lastTime = currentTime;

        this.updateCamera(deltaTime);
        this.updateUniforms();

        const textureView = this.context.getCurrentTexture().createView();
        const commandEncoder = this.device.createCommandEncoder();

        // Используем XPBD физику
        this.physics.update(deltaTime);
        
        // Обновляем буфер позиций данными из физики
        const particleData = this.physics.getParticleData();
        this.device.queue.writeBuffer(this.positionBuffer, 0, particleData);

        // Затем выполняем рендеринг
        const renderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        // Устанавливаем общие параметры
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.setVertexBuffer(0, this.positionBuffer);
        
        // Выбираем pipeline и буфер индексов в зависимости от режима
        if (this.wireframeMode) {
            renderPassEncoder.setPipeline(this.renderPipeline);
            renderPassEncoder.setIndexBuffer(this.wireframeIndexBuffer, 'uint16');
            renderPassEncoder.drawIndexed(this.gridGeometry.wireframeIndexCount);
        } else {
            renderPassEncoder.setPipeline(this.trianglePipeline);
            renderPassEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
            renderPassEncoder.drawIndexed(this.gridGeometry.indexCount);
        }
        
        renderPassEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    startRenderLoop() {
        const renderFrame = (currentTime) => {
            this.render(currentTime);
            requestAnimationFrame(renderFrame);
        };
        requestAnimationFrame(renderFrame);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    console.error(message);
}

async function main() {
    try {
        const renderer = new WebGPURenderer();
        await renderer.init();
        renderer.startRenderLoop();
        
        console.log('WebGPU приложение запущено успешно');
    } catch (error) {
        showError(`Ошибка инициализации: ${error.message}`);
    }
}

window.addEventListener('load', main); 