document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('three-container');
    if (!container) return;
    requestAnimationFrame(() => init());

    function init() {
        const W = container.clientWidth || 400;
        const H = container.clientHeight || 400;

        // ====================================================
        // Scene, Camera, Renderer, Controls
        // ====================================================
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#f8fafc');

        const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
        camera.position.set(3.5, 1.8, 3.5);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.autoClear = false;
        container.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(0, 1.0, 0);
        
        // Change mouse buttons configuration:
        // Left Click = Rotate, Middle/Right Click = Pan
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.PAN
        };

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const d1 = new THREE.DirectionalLight(0xffffff, 0.7);
        d1.position.set(5, 10, 5); scene.add(d1);
        const d2 = new THREE.DirectionalLight(0xffffff, 0.3);
        d2.position.set(-5, 5, -5); scene.add(d2);

        scene.add(new THREE.GridHelper(30, 30, 0x94a3b8, 0xcbd5e1));

        // ====================================================
        // Materials (Low Poly / Flat Shading)
        // ====================================================
        const gMat = new THREE.MeshPhongMaterial({
            color: 0x3b82f6, shininess: 30, flatShading: true,
            transparent: true, opacity: 0.4
        });
        const jMat = new THREE.MeshPhongMaterial({
            color: 0x60a5fa, shininess: 20, flatShading: true,
            transparent: true, opacity: 0.6
        });

        function mkBall(r) { return new THREE.IcosahedronGeometry(r, 1); }
        function mkCyl(r1, r2, h) { return new THREE.CylinderGeometry(r1, r2, h, 8); }

        // ====================================================
        // Articulated Low-Poly Mannequin
        // ====================================================
        const bones = {};
        
        // Root is static, legs attached here
        bones.root = new THREE.Group();
        scene.add(bones.root);

        // --- Individual back material for color change ---
        const getBoneMat = () => new THREE.MeshPhongMaterial({
            color: 0x3b82f6, shininess: 30, flatShading: true,
            transparent: true, opacity: 0.6
        });

        // --- Pelvis (moves with sensor 9 pitch/roll, does not rotate legs) ---
        bones.pelvis = new THREE.Group();
        bones.pelvis.position.set(0, 0.95, 0);
        bones.root.add(bones.pelvis);
        
        bones.matPelvis = getBoneMat();
        let m;
        
        m = new THREE.Mesh(mkCyl(0.16, 0.16, 0.15), bones.matPelvis); m.position.y = 0.075; bones.pelvis.add(m);
        bones.pelvis.add(new THREE.Mesh(mkBall(0.14), jMat)); 

        // --- Spine 1, 2, 3 ---
        bones.spine1 = new THREE.Group(); bones.spine1.position.set(0, 0.15, 0); bones.pelvis.add(bones.spine1);
        bones.matSpine1 = getBoneMat();
        m = new THREE.Mesh(mkCyl(0.15, 0.16, 0.15), bones.matSpine1); m.position.y = 0.075; bones.spine1.add(m);
        bones.spine1.add(new THREE.Mesh(mkBall(0.13), jMat));

        bones.spine2 = new THREE.Group(); bones.spine2.position.set(0, 0.15, 0); bones.spine1.add(bones.spine2);
        bones.matSpine2 = getBoneMat();
        m = new THREE.Mesh(mkCyl(0.15, 0.15, 0.15), bones.matSpine2); m.position.y = 0.075; bones.spine2.add(m);
        bones.spine2.add(new THREE.Mesh(mkBall(0.13), jMat));

        bones.spine3 = new THREE.Group(); bones.spine3.position.set(0, 0.15, 0); bones.spine2.add(bones.spine3);
        bones.matSpine3 = getBoneMat();
        m = new THREE.Mesh(mkCyl(0.16, 0.15, 0.15), bones.matSpine3); m.position.y = 0.075; bones.spine3.add(m);
        bones.spine3.add(new THREE.Mesh(mkBall(0.14), jMat));

        // --- Chest ---
        bones.chest = new THREE.Group(); bones.chest.position.set(0, 0.15, 0); bones.spine3.add(bones.chest);
        bones.matChest = getBoneMat();
        m = new THREE.Mesh(mkCyl(0.17, 0.16, 0.15), bones.matChest); m.position.y = 0.075; bones.chest.add(m);
        bones.chest.add(new THREE.Mesh(mkBall(0.15), jMat));

        // --- Neck & Head ---
        bones.neck = new THREE.Group(); bones.neck.position.set(0, 0.15, 0); bones.chest.add(bones.neck);
        
        m = new THREE.Mesh(mkCyl(0.05, 0.06, 0.06), gMat); m.position.y = 0.03; bones.neck.add(m);
        bones.head = new THREE.Group(); bones.head.position.set(0, 0.06, 0); bones.neck.add(bones.head);
        
        m = new THREE.Mesh(mkBall(0.15), gMat); m.position.y = 0.12; bones.head.add(m);

        // --- Arms ---
        function buildArm(sign) {
            const anchor = new THREE.Group();
            anchor.position.set(sign * 0.19, 0.10, 0);
            bones.chest.add(anchor);

            // Shoulder pad mount
            const shoulderPad = new THREE.Group();
            anchor.add(shoulderPad);
            shoulderPad.add(new THREE.Mesh(mkBall(0.045), jMat)); 

            // Upper arm attached to static anchor
            const upperArm = new THREE.Group(); 
            anchor.add(upperArm);
            
            m = new THREE.Mesh(mkCyl(0.075, 0.07, 0.28), gMat); m.position.y = -0.14; upperArm.add(m);

            const elbow = new THREE.Group(); elbow.position.set(0, -0.28, 0); upperArm.add(elbow);
            elbow.add(new THREE.Mesh(mkBall(0.07), jMat)); 

            const forearm = new THREE.Group(); elbow.add(forearm);
            
            m = new THREE.Mesh(mkCyl(0.07, 0.065, 0.26), gMat); m.position.y = -0.13; forearm.add(m);

            const hand = new THREE.Group(); hand.position.set(0, -0.26, 0); forearm.add(hand);
            hand.add(new THREE.Mesh(mkBall(0.075), jMat)); 

            return { anchor, shoulderPad, upperArm, elbow, forearm, hand };
        }
        const lArm = buildArm(-1);
        const rArm = buildArm(+1);
        
        // Expose lShoulder/rShoulder as shoulderPad only
        bones.lShoulder = lArm.shoulderPad; 
        bones.rShoulder = rArm.shoulderPad;

        // --- Legs (Bound to Root to stay grounded during back bending) ---
        const hips = new THREE.Group();
        hips.position.set(0, 0.95, 0);
        bones.root.add(hips);

        function buildLeg(sign) {
            
            const hip = new THREE.Group(); hip.position.set(sign * 0.12, 0, 0); hips.add(hip);
            hip.add(new THREE.Mesh(mkBall(0.08), jMat));

            
            const thigh = new THREE.Group(); hip.add(thigh);
            m = new THREE.Mesh(mkCyl(0.10, 0.09, 0.42), gMat); m.position.y = -0.21; thigh.add(m);

            const knee = new THREE.Group(); knee.position.set(0, -0.42, 0); thigh.add(knee);
            knee.add(new THREE.Mesh(mkBall(0.085), jMat));

            
            const shin = new THREE.Group(); knee.add(shin);
            m = new THREE.Mesh(mkCyl(0.09, 0.08, 0.47), gMat); m.position.y = -0.235; shin.add(m);

            const ankle = new THREE.Group(); ankle.position.set(0, -0.47, 0); shin.add(ankle);
            ankle.add(new THREE.Mesh(mkBall(0.075), jMat));
            
            
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.22), gMat);
            foot.position.set(0, -0.03, 0.05); ankle.add(foot);
        }
        buildLeg(-1); buildLeg(+1);

        // --- Pose: Hands clasped forward ---
        // Arms pointing forward-center (static pose)
        lArm.anchor.rotation.z = 0.2;
        lArm.upperArm.rotation.x = -1.2;
        lArm.upperArm.rotation.z = 0.45;
        lArm.forearm.rotation.x = -0.5;
        lArm.forearm.rotation.z = -0.1; 

        rArm.anchor.rotation.z = -0.2;
        rArm.upperArm.rotation.x = -1.2;
        rArm.upperArm.rotation.z = -0.45;
        rArm.forearm.rotation.x = -0.5;
        rArm.forearm.rotation.z = 0.1;

        window.mannequinBones = bones;

        // ====================================================
        // Impact Wrench (Held correctly between both hands)
        // ====================================================
        const wrench = new THREE.Group();
        // Default OFF (Transparent Red)
        const wMat = new THREE.MeshPhongMaterial({ color: 0xef4444, flatShading: true, transparent: true, opacity: 0.5 });
        const wNoseMat = new THREE.MeshPhongMaterial({ color: 0xb91c1c, flatShading: true, transparent: true, opacity: 0.5 });

        // Global function to change drill color (Called from app.js)
        window.updateWrenchState = (isOn) => {
            if (isOn) {
                // Transparent Green if ON
                wMat.color.setHex(0x22c55e);
                wNoseMat.color.setHex(0x16a34a);
            } else {
                // Transparent Red if OFF
                wMat.color.setHex(0xef4444);
                wNoseMat.color.setHex(0xb91c1c);
            }
        };

        // Wrench origin moved to Handle
        const handle = new THREE.Mesh(mkCyl(0.025, 0.02, 0.14), wMat);
        handle.position.set(0, 0, 0); 
        wrench.add(handle);

        const housing = new THREE.Mesh(mkCyl(0.045, 0.05, 0.22), wMat);
        housing.rotation.x = Math.PI / 2; // ROTATE X AXIS TO FACE FRONT (Z)
        housing.position.set(0, 0.08, 0.05); 
        wrench.add(housing);

        const nose = new THREE.Mesh(mkCyl(0.02, 0.035, 0.10), wNoseMat);
        nose.rotation.x = Math.PI / 2; // PUTAR SUMBU X AGAR MENGHADAP DEPAN
        nose.position.set(0, 0.08, 0.20); 
        wrench.add(nose);

        // Attach drill to chest for absolute straight direction
        wrench.position.set(0, 0.08, 0.42); 
        wrench.rotation.set(0, 0, 0); 
        bones.chest.add(wrench);


        // ====================================================
        // Dynamic Sensors (Attached to Bones)
        // ====================================================
        const nMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
        const nGeo = new THREE.IcosahedronGeometry(0.04, 1);
        const sensors = {};

        function addSensor(parent, id, offset) {
            const grp = new THREE.Group();
            grp.position.copy(offset);
            parent.add(grp);

            const c = document.createElement('canvas');
            c.width = 72; c.height = 72;
            const ctx = c.getContext('2d');
            
            ctx.fillStyle = '#ffffff'; 
            ctx.beginPath(); ctx.arc(36, 36, 34, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 3; ctx.stroke();
            
            ctx.fillStyle = '#0f172a'; ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(id, 36, 38);
            
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ 
                map: new THREE.CanvasTexture(c), 
                depthTest: false,
                color: 0x22c55e 
            }));
            sp.scale.set(0.12, 0.12, 1);
            sp.position.set(0, 0, 0); 
            grp.add(sp);
            
            sensors[id] = grp;
        }

        addSensor(bones.rShoulder, '2', new THREE.Vector3( 0.06, 0, -0.07));
        addSensor(bones.lShoulder, '3', new THREE.Vector3(-0.06, 0, -0.07));
        // Sensors attached directly to lower spine & pelvis
        addSensor(bones.chest,  '5', new THREE.Vector3(0, 0.075, -0.18));
        addSensor(bones.spine2, '7', new THREE.Vector3(0, 0.075, -0.17));
        addSensor(bones.spine1, '8', new THREE.Vector3(0, 0.075, -0.17));
        addSensor(bones.pelvis, '9', new THREE.Vector3(0, 0.075, -0.17));

        // Shoulder line remains straight
        const linkGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 6);
        const linkMat = new THREE.MeshBasicMaterial({ color: 0x22c55e }); 
        const lines = {
            '2-5': new THREE.Mesh(linkGeo, linkMat.clone()),
            '3-5': new THREE.Mesh(linkGeo, linkMat.clone())
        };
        for (const k in lines) {
            lines[k].userData.isLine = true; // Marker so it's not hidden by checkbox
            scene.add(lines[k]);
        }

        // Curve mesh for smooth spine
        const curveMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        let curveMesh = new THREE.Mesh(new THREE.BufferGeometry(), curveMat);
        curveMesh.userData.isLine = true;
        scene.add(curveMesh);

        const colorGreen = new THREE.Color(0x22c55e); // Straight = Green
        const colorYellow = new THREE.Color(0xeab308); // Slightly bent = Yellow
        const colorOrange = new THREE.Color(0xf97316); // Bent = Orange
        const colorRed = new THREE.Color(0xef4444);   // Very bent = Red

        function getGradientColor(f) {
            if (f < 0.33) return colorGreen.clone().lerp(colorYellow, f / 0.33);
            if (f < 0.66) return colorYellow.clone().lerp(colorOrange, (f - 0.33) / 0.33);
            return colorOrange.clone().lerp(colorRed, (f - 0.66) / 0.34);
        }

        function updateSensorLines() {
            const wp = (id) => { const v = new THREE.Vector3(); sensors[id].getWorldPosition(v); return v; };
            const p2=wp('2'), p3=wp('3'), p5=wp('5'), p7=wp('7'), p8=wp('8'), p9=wp('9');
            
            // Measure actual "curve angle" from lines formed by sensor points (5, 7, 8, 9)
            const v1 = new THREE.Vector3().subVectors(p5, p7).normalize();
            const v2 = new THREE.Vector3().subVectors(p7, p8).normalize();
            const v3 = new THREE.Vector3().subVectors(p8, p9).normalize();
            
            // Total curve angle in radians
            const totalCurveAngle = v1.angleTo(v2) + v2.angleTo(v3);
                               
            // The more curved the 5-7-8-9 points, the smoother the transition to red 
            const bendFactor = Math.min(1, totalCurveAngle / 0.35);
            const targetColor = getGradientColor(bendFactor);

            // Update UI Panel for "Total Curve"
            const uiCurve = document.getElementById('val-curve');
            if (uiCurve) {
                const angleDeg = totalCurveAngle * (180 / Math.PI);
                uiCurve.innerText = angleDeg.toFixed(2) + '°';
                uiCurve.style.color = '#' + targetColor.getHexString();
            }

            // Color all sensor dots
            ['2', '3', '5', '7', '8', '9'].forEach(id => {
                if (sensors[id] && sensors[id].children[0]) {
                    sensors[id].children[0].material.color.copy(targetColor);
                }
            });

            // Update straight line from shoulder to chest
            function placeCyl(mesh, pA, pB) {
                const dist = pA.distanceTo(pB);
                if (dist < 0.001) return;
                mesh.position.copy(pA).lerp(pB, 0.5);
                mesh.scale.set(1, dist, 1);
                mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pB.clone().sub(pA).normalize());
                mesh.material.color.copy(targetColor);
            }
            placeCyl(lines['2-5'], p2, p5);
            placeCyl(lines['3-5'], p3, p5);

            // Update curved back (9 -> 8 -> 7 -> 5)
            const curve = new THREE.CatmullRomCurve3([p9, p8, p7, p5]);
            curve.tension = 0.5; // Adjust curve smoothness
            
            if (curveMesh.geometry) curveMesh.geometry.dispose();
            curveMesh.geometry = new THREE.TubeGeometry(curve, 20, 0.015, 6, false);
            curveMesh.material.color.copy(targetColor);
        }


        // ====================================================
        // ViewCube
        // ====================================================
        const CUBE_SZ = 100;
        const CUBE_PD = 16;
        const cubeScene = new THREE.Scene();
        cubeScene.background = null; 

        const cubeCamera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
        cubeCamera.position.set(0, 0, 5);
        cubeScene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const cLight = new THREE.DirectionalLight(0xffffff, 0.5);
        cLight.position.set(3, 5, 5); cubeScene.add(cLight);

        const pS = 1.3;
        const interactivePcs = [];
        const cubeGrp = new THREE.Group();

        function makePcMat(hover) {
            const cv = document.createElement('canvas');
            cv.width = 32; cv.height = 32;
            const cx = cv.getContext('2d');
            cx.fillStyle = hover ? '#bfdbfe' : '#e2e8f0';
            cx.fillRect(0, 0, 32, 32);
            return new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cv) });
        }

        function makeLabelMat(text) {
            const cv = document.createElement('canvas');
            cv.width = 512; cv.height = 512;
            const cx = cv.getContext('2d');
            cx.clearRect(0,0,512,512);
            cx.fillStyle = '#1e3a5f';
            cx.font = 'bold 122px Arial'; 
            cx.textAlign = 'center'; cx.textBaseline = 'middle';
            cx.fillText(text, 256, 256);
            return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false });
        }
        
        const labelMats = [
            makeLabelMat('RIGHT'), makeLabelMat('LEFT'),
            makeLabelMat('TOP'), makeLabelMat('BOT'),
            makeLabelMat('FRONT'), makeLabelMat('BACK')
        ];

        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    if (x===0&&y===0&&z===0) continue;
                    const geo = new THREE.BoxGeometry(pS, pS, pS);
                    const mats = [];
                    for (let fi = 0; fi < 6; fi++) mats.push(makePcMat(false));
                    const mesh = new THREE.Mesh(geo, mats.slice());
                    mesh.position.set(x*pS, y*pS, z*pS);
                    mesh.userData = { direction: new THREE.Vector3(x,y,z).normalize(), defaultMats: mats };
                    cubeGrp.add(mesh);
                    interactivePcs.push(mesh);
                }
            }
        }

        
        const tGeo = new THREE.PlaneGeometry(pS*3, pS*3);
        const tDist = pS*1.5 + 0.05; 
        const tData = [
            {m: labelMats[0], p: [tDist,0,0], r: [0, Math.PI/2, 0]},
            {m: labelMats[1], p: [-tDist,0,0], r: [0, -Math.PI/2, 0]},
            {m: labelMats[2], p: [0,tDist,0], r: [-Math.PI/2, 0, 0]},
            {m: labelMats[3], p: [0,-tDist,0], r: [Math.PI/2, 0, 0]},
            {m: labelMats[4], p: [0,0,tDist], r: [0, 0, 0]},
            {m: labelMats[5], p: [0,0,-tDist], r: [0, Math.PI, 0]}
        ];
        tData.forEach(d => {
            const mesh = new THREE.Mesh(tGeo, d.m);
            mesh.position.set(...d.p);
            mesh.rotation.set(...d.r);
            cubeGrp.add(mesh);
        });
        
        cubeGrp.add(new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(pS*3, pS*3, pS*3)),
            new THREE.LineBasicMaterial({ color: 0x94a3b8 })
        ));
        cubeScene.add(cubeGrp);

        // ====================================================
        // Toggle Model Visibility
        // ====================================================
        const toggleModel = document.getElementById('toggle-model');
        if (toggleModel) {
            toggleModel.addEventListener('change', (e) => {
                const show = e.target.checked;
                bones.root.traverse(child => {
                    if ((child instanceof THREE.Mesh) && !child.userData.isLine) {
                        child.visible = show;
                    }
                });
            });
        }

        const ray = new THREE.Raycaster();
        const mpos = new THREE.Vector2();
        let targetCamPos = null;
        let hovPiece = null;

        container.addEventListener('pointermove', (e) => {
            const rect = container.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;
            const cw = container.clientWidth;
            const vL = cw - CUBE_SZ - CUBE_PD;
            const vR = cw - CUBE_PD;
            const vT = CUBE_PD;
            const vB = CUBE_PD + CUBE_SZ;

            if (hovPiece) { hovPiece.material = hovPiece.userData.defaultMats; hovPiece = null; container.style.cursor = ''; }
            
            if (px >= vL && px <= vR && py >= vT && py <= vB) {
                mpos.x = ((px - vL) / CUBE_SZ) * 2 - 1;
                mpos.y = -((py - vT) / CUBE_SZ) * 2 + 1;
                ray.setFromCamera(mpos, cubeCamera);
                const hits = ray.intersectObjects(interactivePcs);
                if (hits.length > 0) {
                    hovPiece = hits[0].object;
                    hovPiece.material = hovPiece.userData.defaultMats.map(m => {
                        const h = m.clone(); h.color.setHex(0xbfdbfe); return h;
                    });
                    container.style.cursor = 'pointer';
                }
            }
        });

        container.addEventListener('pointerdown', () => {
            if (hovPiece) {
                const dir = hovPiece.userData.direction.clone();
                const dist = camera.position.distanceTo(controls.target);
                targetCamPos = controls.target.clone().add(dir.multiplyScalar(dist));
            }
        });

        new ResizeObserver(() => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w > 0 && h > 0) {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            }
        }).observe(container);

        function animate() {
            requestAnimationFrame(animate);

            if (targetCamPos) {
                camera.position.lerp(targetCamPos, 0.1);
                if (camera.position.distanceTo(targetCamPos) < 0.05) {
                    camera.position.copy(targetCamPos);
                    targetCamPos = null;
                }
            }
            controls.update();
            updateSensorLines();

            const cw = container.clientWidth;
            const ch = container.clientHeight;

            renderer.setViewport(0, 0, cw, ch);
            renderer.setScissor(0, 0, cw, ch);
            renderer.setScissorTest(true);
            renderer.clear();
            renderer.render(scene, camera);

            cubeCamera.position.copy(camera.position).sub(controls.target).normalize().multiplyScalar(5);
            cubeCamera.lookAt(0, 0, 0);

            const cvX = cw - CUBE_SZ - CUBE_PD;
            const cvY = ch - CUBE_SZ - CUBE_PD;
            renderer.setViewport(cvX, cvY, CUBE_SZ, CUBE_SZ);
            renderer.setScissor(cvX, cvY, CUBE_SZ, CUBE_SZ);
            renderer.clearDepth();
            renderer.render(cubeScene, cubeCamera);
        }
        animate();
    }
});
