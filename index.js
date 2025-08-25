import { Key } from './Keys.js';

const view = document.querySelector("canvas").getContext("2d");
const canvas = view.canvas;
view.lineCap = "round";
let ring = null;
function resizeCanvas() {
    view.canvas.width = innerWidth;
    view.canvas.height = innerHeight;
    ring?.resize();
}
addEventListener("resize", resizeCanvas);
resizeCanvas();

class Boundary {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        const nucleusFactor = 0.5;
        this.innerRadius = radius * nucleusFactor;
    }
    resize() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = canvas.height > canvas.width ? canvas.width / 2.1 : canvas.height / 2.1;
    }
    draw() {
        view.strokeStyle = "white";
        view.beginPath();
        view.arc(canvas.width / 2, canvas.height / 2, this.radius + 5, 0, Math.PI * 2);
        view.arc(canvas.width / 2, canvas.height / 2, this.radius - 5, 0, Math.PI * 2);
        view.stroke();
    }
}

class Deflector { // paddle
    constructor(boundary, pos, color) {
        this.boundary = boundary;
        this.pos = pos;
        this.size = 0.05; // proportion of circumference
        this.width = 10;
        this.color = color;
    }
    update() {
        // Update paddle position or other properties if needed
        const offset = Math.PI / 2; // zero = north (not east)
        this.rotate();
        this.startAngle = (this.pos - this.size / 2) * Math.PI * 2 - offset;
        this.endAngle = (this.pos + this.size / 2) * Math.PI * 2 - offset;
    }
    draw() {
        const oldStrokeStyle = view.strokeStyle;
        view.strokeStyle = this.color;
        const oldLineWidth = view.lineWidth;
        view.lineWidth = 10;
        view.beginPath();
        view.arc(this.boundary.x, this.boundary.y, this.boundary.radius, this.startAngle, this.endAngle);
        view.stroke();
        view.lineWidth = oldLineWidth;
        view.strokeStyle = oldStrokeStyle;
    }
    rotatePos(amount = 0.005) {
        this.pos += amount;
        this.pos %= 1;
    }
    rotateNeg(amount = 0.001) {
        this.pos -= amount;
        this.pos %= 1;
    }
    rotate(amount = 0.001) {
        this.pos += amount;
        this.pos %= 1;
    }
}

class Electron {
    constructor(boundary, position) {
        this.boundary = boundary;
        this.x = boundary.x + Math.cos(Math.PI * 2 * position) * boundary.radius * 0.95;
        this.y = boundary.y + Math.sin(Math.PI * 2 * position) * boundary.radius * 0.95;

        // calculate angle from electron position to boundary center
        const angle = Math.atan2(boundary.y - this.y, boundary.x - this.x);

        this.speed = 4; // default speed
        this.dx = Math.cos(angle) * this.speed;
        this.dy = Math.sin(angle) * this.speed;
        this.size = 8;
        this.annihilate = false;
    }
    update() {
        this.x += this.dx;
        this.y += this.dy;
    }
    draw() {
        view.fillStyle = "red";
        view.beginPath();
        view.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        view.fill();
    }
    checkBoundaryCollision() {
        const dist = Math.hypot(this.x - this.boundary.x, this.y - this.boundary.y);
        if (dist + this.size >= this.boundary.radius) {
            this.annihilate = false;

            // step back so electron is inside the boundary
            this.x -= this.dx;
            this.y -= this.dy;

            // calculate normal to the circle at intersection (this.x, this.y)
            const nx = (this.x - this.boundary.x) / this.boundary.radius;
            const ny = (this.y - this.boundary.y) / this.boundary.radius;

            // reflect the current direction vector (this.dx, this.dy)
            const dot = this.dx * nx + this.dy * ny;
            this.dx -= 2 * dot * nx;
            this.dy -= 2 * dot * ny;

            return true;
        }
        return false;
    }
    checkDeflectorCollision(deflectors) {
        // calculate angle of electron
        let angle = Math.atan2(this.y - this.boundary.y, this.x - this.boundary.x);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        for (const d of deflectors) {
            const hit = angle > d.startAngle && angle < d.endAngle;
            if (hit) {
                // bounce electron towards center of boundary
                const vectorToCenter = {
                    x: this.boundary.x - this.x,
                    y: this.boundary.y - this.y
                };
                const length = Math.hypot(vectorToCenter.x, vectorToCenter.y);
                vectorToCenter.x /= length;
                vectorToCenter.y /= length;

                this.dx = vectorToCenter.x * this.speed;
                this.dy = vectorToCenter.y * this.speed;
            }
        }

    }
}

class Nucleon {
    constructor(boundary, x, y, angle, distance, direction = 1) {
        this.boundary = boundary;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.distance = distance;
        this.direction = direction;
        this.size = 8;
        this.active = true;
    }
    update() {
        if (!this.active) return;
        this.angle += 0.01 * this.direction; // Rotate around the boundary
        this.x = this.boundary.x + Math.cos(this.angle) * (this.distance);// * Math.sin(this.angle * 2));
        this.y = this.boundary.y + Math.sin(this.angle) * (this.distance);// * Math.sin(this.angle * 2));
    }
    draw() {
        if (!this.active) return;
        view.fillStyle = "yellow";
        view.beginPath();
        view.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        view.fill();
    }
}

class Atom {
    constructor() {
        this.boundary = new Boundary(canvas.width / 2, canvas.height / 2, canvas.height / 2.1);
        this.nucleons = [];
        this.electrons = [];
        this.deflectors = [];

        const numOuterNucleons = 10;
        for (let i = 0; i < numOuterNucleons; i++) {
            const angle = (i / numOuterNucleons) * Math.PI * 2;
            const distance = this.boundary.innerRadius * numOuterNucleons * 0.1; // Adjust distance from center
            const x = this.boundary.x + Math.cos(angle) * distance;
            const y = this.boundary.y + Math.sin(angle) * distance;
            this.nucleons.push(new Nucleon(this.boundary, x, y, angle, distance));
        }

        // another ring of nucleons closer to the center of the boundary
        const numMiddleNucleons = 5;
        for (let i = 0; i < numMiddleNucleons; i++) {
            const angle = (i / numMiddleNucleons) * Math.PI * 2;
            const distance = this.boundary.innerRadius * numMiddleNucleons * 0.1;
            const x = this.boundary.x + Math.cos(angle) * distance;
            const y = this.boundary.y + Math.sin(angle) * distance;
            this.nucleons.push(new Nucleon(this.boundary, x, y, angle, distance, -1));
        }

        // another ring of nucleons even closer to the center of the boundary
        const numInnerNucleons = 3;
        for (let i = 0; i < numInnerNucleons; i++) {
            const angle = (i / numInnerNucleons) * Math.PI * 2;
            const distance = this.boundary.innerRadius * numInnerNucleons * 0.1;
            const x = this.boundary.x + Math.cos(angle) * distance;
            const y = this.boundary.y + Math.sin(angle) * distance;
            this.nucleons.push(new Nucleon(this.boundary, x, y, angle, distance));
        }

        this.electrons.push(new Electron(this.boundary, 0));
        this.electrons.push(new Electron(this.boundary, 0.75));

        this.deflectors.push(new Deflector(this.boundary, 0, "blue"));
        this.deflectors.push(new Deflector(this.boundary, 0.5, "green"));
    }
    update() {
        for (const n of this.nucleons) n.update();
        for (const e of this.electrons) e.update();
        for (const d of this.deflectors) d.update();
    }
    draw() {
        this.boundary.draw();
        for (const n of this.nucleons) n.draw();
        for (const e of this.electrons) e.draw();
        for (const d of this.deflectors) d.draw();
    }
    step() {
        this.update();
        this.checkNucleonElectronCollisions();
        this.checkBoundaryElectronCollisions();
        this.draw();
    }
    checkBoundaryElectronCollisions() {

        for (const e of this.electrons) {
            if(e.checkBoundaryCollision()) {
                e.checkDeflectorCollision(this.deflectors);
            }
        }

        // for (const d of this.deflectors) {
        //     for (const e of this.electrons) {
        //         const dist = Math.hypot(d.x - e.x, d.y - e.y);
        //         if (dist < d.size + e.size) {
        //             // Simple elastic collision response
        //             const angle = Math.atan2(e.y - d.y, e.x - d.x);
        //             const speed = Math.hypot(e.dx, e.dy);
        //             e.dx = Math.cos(angle) * speed;
        //             e.dy = Math.sin(angle) * speed;
        //             d.active = false; // Deactivate deflector on collision
        //         }
        //     }
        // }
    }
    checkNucleonElectronCollisions() {
        for (const n of this.nucleons) {
            if (!n.active) continue;
            for (const e of this.electrons) {
                const dist = Math.hypot(n.x - e.x, n.y - e.y);
                if (dist < n.size + e.size) {
                    // Simple elastic collision response
                    const angle = Math.atan2(e.y - n.y, e.x - n.x);
                    const speed = Math.hypot(e.dx, e.dy);
                    e.dx = Math.cos(angle) * speed;
                    e.dy = Math.sin(angle) * speed;
                    n.active = false; // Deactivate nucleon on collision
                }
            }
        }
    }
}

const atom = new Atom();

function animate() {
    view.clearRect(0, 0, canvas.width, canvas.height);
    //if (Key.Down("ArrowLeft")) paddle1.rotateNeg();
    //if (Key.Down("ArrowRight")) paddle1.rotatePos();
    atom.step();
    requestAnimationFrame(animate);
}

animate();