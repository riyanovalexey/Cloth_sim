// Утилиты для 3D математики и работы с матрицами

class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static add(a, b) {
        return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    static subtract(a, b) {
        return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    static scale(v, s) {
        return new Vec3(v.x * s, v.y * s, v.z * s);
    }

    static normalize(v) {
        const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (len === 0) return new Vec3(0, 0, 0);
        return new Vec3(v.x / len, v.y / len, v.z / len);
    }

    static cross(a, b) {
        return new Vec3(
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x
        );
    }

    static dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }
}

class Mat4 {
    constructor() {
        // Создаем единичную матрицу 4x4
        this.elements = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    }

    static identity() {
        return new Mat4();
    }

    static perspective(fovy, aspect, near, far) {
        const mat = new Mat4();
        const f = 1.0 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);

        mat.elements[0] = f / aspect;
        mat.elements[1] = 0;
        mat.elements[2] = 0;
        mat.elements[3] = 0;

        mat.elements[4] = 0;
        mat.elements[5] = f;
        mat.elements[6] = 0;
        mat.elements[7] = 0;

        mat.elements[8] = 0;
        mat.elements[9] = 0;
        mat.elements[10] = (far + near) * nf;
        mat.elements[11] = -1;

        mat.elements[12] = 0;
        mat.elements[13] = 0;
        mat.elements[14] = 2 * far * near * nf;
        mat.elements[15] = 0;

        return mat;
    }

    static lookAt(eye, center, up) {
        const mat = new Mat4();
        
        const f = Vec3.normalize(Vec3.subtract(center, eye));
        const s = Vec3.normalize(Vec3.cross(f, up));
        const u = Vec3.cross(s, f);

        mat.elements[0] = s.x;
        mat.elements[1] = u.x;
        mat.elements[2] = -f.x;
        mat.elements[3] = 0;

        mat.elements[4] = s.y;
        mat.elements[5] = u.y;
        mat.elements[6] = -f.y;
        mat.elements[7] = 0;

        mat.elements[8] = s.z;
        mat.elements[9] = u.z;
        mat.elements[10] = -f.z;
        mat.elements[11] = 0;

        mat.elements[12] = -Vec3.dot(s, eye);
        mat.elements[13] = -Vec3.dot(u, eye);
        mat.elements[14] = Vec3.dot(f, eye);
        mat.elements[15] = 1;

        return mat;
    }

    static translate(x, y, z) {
        const mat = new Mat4();
        mat.elements[12] = x;
        mat.elements[13] = y;
        mat.elements[14] = z;
        return mat;
    }

    static rotateY(angle) {
        const mat = new Mat4();
        const c = Math.cos(angle);
        const s = Math.sin(angle);

        mat.elements[0] = c;
        mat.elements[2] = s;
        mat.elements[8] = -s;
        mat.elements[10] = c;

        return mat;
    }

    static multiply(a, b) {
        const result = new Mat4();
        const ae = a.elements;
        const be = b.elements;
        const te = result.elements;

        const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
        const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
        const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
        const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];

        const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
        const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
        const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
        const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

        te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
        te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
        te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
        te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

        te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
        te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
        te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
        te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

        te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
        te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
        te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
        te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

        te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
        te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
        te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
        te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

        return result;
    }
}

// Класс для управления камерой
class Camera {
    constructor() {
        this.position = new Vec3(0, 5, 10); // Поднимаем камеру выше для лучшего обзора сетки
        this.target = new Vec3(0, 0, 0);
        this.up = new Vec3(0, 1, 0);
        
        // Параметры для FPS-style управления
        this.yaw = -90;   // Поворот по Y (влево-вправо)
        this.pitch = -20; // Поворот по X (вверх-вниз) - смотрим немного вниз
        
        this.speed = 5.0;
        this.sensitivity = 0.1;
        
        this.updateCameraVectors();
    }

    updateCameraVectors() {
        // Вычисляем направление взгляда на основе углов
        const front = new Vec3();
        front.x = Math.cos(this.yaw * Math.PI / 180) * Math.cos(this.pitch * Math.PI / 180);
        front.y = Math.sin(this.pitch * Math.PI / 180);
        front.z = Math.sin(this.yaw * Math.PI / 180) * Math.cos(this.pitch * Math.PI / 180);
        
        this.front = Vec3.normalize(front);
        this.target = Vec3.add(this.position, this.front);
        
        // Вычисляем правый вектор и вектор вверх
        this.right = Vec3.normalize(Vec3.cross(this.front, new Vec3(0, 1, 0)));
        this.up = Vec3.normalize(Vec3.cross(this.right, this.front));
    }

    getViewMatrix() {
        return Mat4.lookAt(this.position, this.target, this.up);
    }

    processKeyboard(direction, deltaTime) {
        const velocity = this.speed * deltaTime;
        
        switch(direction) {
            case 'FORWARD':
                this.position = Vec3.add(this.position, Vec3.scale(this.front, velocity));
                break;
            case 'BACKWARD':
                this.position = Vec3.subtract(this.position, Vec3.scale(this.front, velocity));
                break;
            case 'LEFT':
                this.position = Vec3.subtract(this.position, Vec3.scale(this.right, velocity));
                break;
            case 'RIGHT':
                this.position = Vec3.add(this.position, Vec3.scale(this.right, velocity));
                break;
            case 'UP':
                this.position = Vec3.add(this.position, Vec3.scale(this.up, velocity));
                break;
            case 'DOWN':
                this.position = Vec3.subtract(this.position, Vec3.scale(this.up, velocity));
                break;
        }
        
        this.updateCameraVectors();
    }

    processMouseMovement(xoffset, yoffset) {
        xoffset *= this.sensitivity;
        yoffset *= this.sensitivity;

        this.yaw += xoffset;
        this.pitch += yoffset;

        // Ограничиваем pitch
        if (this.pitch > 89.0) this.pitch = 89.0;
        if (this.pitch < -89.0) this.pitch = -89.0;

        this.updateCameraVectors();
    }
}

// Класс для создания геометрии сетки
class GridGeometry {
    static createGrid(width, height, segmentsX, segmentsY) {
        const vertices = [];
        const indices = [];
        
        const stepX = width / segmentsX;
        const stepY = height / segmentsY;
        
        console.log(`Создание сетки ${segmentsX}x${segmentsY}, размер ${width}x${height}`);
        
        // Создаем вершины
        for (let y = 0; y <= segmentsY; y++) {
            for (let x = 0; x <= segmentsX; x++) {
                const posX = (x * stepX) - (width / 2);
                const posY = 0; // Горизонтальная сетка (Y = 0)
                const posZ = (y * stepY) - (height / 2);
                
                vertices.push(posX, posY, posZ);
            }
        }
        
        const vertexCount = vertices.length / 3;
        console.log(`Создано ${vertexCount} вершин (${segmentsX + 1} x ${segmentsY + 1})`);
        
        // Создаем индексы для треугольников
        for (let y = 0; y < segmentsY; y++) {
            for (let x = 0; x < segmentsX; x++) {
                const topLeft = y * (segmentsX + 1) + x;
                const topRight = topLeft + 1;
                const bottomLeft = (y + 1) * (segmentsX + 1) + x;
                const bottomRight = bottomLeft + 1;
                
                // Первый треугольник квадрата
                indices.push(topLeft, bottomLeft, topRight);
                // Второй треугольник квадрата
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }
        
        // Создаем wireframe индексы - рисуем сетку линий + диагонали треугольников
        const wireframeIndices = [];
        
        // Горизонтальные линии
        for (let y = 0; y <= segmentsY; y++) {
            for (let x = 0; x < segmentsX; x++) {
                const left = y * (segmentsX + 1) + x;
                const right = left + 1;
                wireframeIndices.push(left, right);
            }
        }
        
        // Вертикальные линии
        for (let y = 0; y < segmentsY; y++) {
            for (let x = 0; x <= segmentsX; x++) {
                const top = y * (segmentsX + 1) + x;
                const bottom = (y + 1) * (segmentsX + 1) + x;
                wireframeIndices.push(top, bottom);
            }
        }
        
        // Диагонали квадратов для показа треугольников
        for (let y = 0; y < segmentsY; y++) {
            for (let x = 0; x < segmentsX; x++) {
                const topLeft = y * (segmentsX + 1) + x;
                const topRight = topLeft + 1;
                const bottomLeft = (y + 1) * (segmentsX + 1) + x;
                const bottomRight = bottomLeft + 1;
                
                // Добавляем диагональ от topLeft к bottomRight
                wireframeIndices.push(topLeft, bottomRight);
            }
        }
        
        console.log(`Создано ${wireframeIndices.length} wireframe индексов`);
        
        // Проверим максимальный индекс
        const maxWireframeIndex = Math.max(...wireframeIndices);
        console.log(`Максимальный wireframe индекс: ${maxWireframeIndex}, количество вершин: ${vertexCount}`);
        
        if (maxWireframeIndex >= vertexCount) {
            console.error(`ОШИБКА: Максимальный индекс ${maxWireframeIndex} больше количества вершин ${vertexCount}`);
        }

        return {
            vertices: new Float32Array(vertices),
            indices: new Uint16Array(indices),
            wireframeIndices: new Uint16Array(wireframeIndices),
            vertexCount: vertexCount,
            indexCount: indices.length,
            wireframeIndexCount: wireframeIndices.length
        };
    }
    
    static createPlane(width = 10, height = 10, segmentsX = 20, segmentsY = 20) {
        return GridGeometry.createGrid(width, height, segmentsX, segmentsY);
    }
}