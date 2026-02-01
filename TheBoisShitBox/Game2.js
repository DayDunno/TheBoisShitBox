/**
 * GAME 2: STONKS OR BRONKS
 * Roles: PUMPER, CRASHER, CASHER
 */

(function() {
    console.log("Loading Game 2: Stonks or Bronks...");

    /* ==========================================
       1. CONFIGURATION & INJECTION
       ========================================== */
    
    const STONKS_CONFIG = {
        title: "Stonks or Bronks",
        rounds: 9,
        tickRate: 100,
        baseRise: 0.5,
        pumpPower: 2.0,
        crashPower: 2.5,
    };

    /* Add to Library if it exists */
    if (typeof GAME_LIBRARY !== 'undefined') {
        GAME_LIBRARY['GAME2'] = {
            title: STONKS_CONFIG.title,
            maxRounds: STONKS_CONFIG.rounds,
            prompts: [] 
        };
    }

    /* ==========================================
       2. SERVER HIJACKING (HOST LOGIC)
       ========================================== */

    const originalStartGame = BrowserServer.prototype.startGame;
    
    BrowserServer.prototype.startGame = function() {
        const selector = document.getElementById('game-selector');
        const currentSelection = selector ? selector.value : this.currentGameMode;

        if (currentSelection === 'GAME2') {
            console.log("Starting Stonks Mode");
            this.currentGameMode = 'GAME2';
            this.startStonksGame();
        } else {
            originalStartGame.apply(this, arguments);
        }
    };

    /* --- CUSTOM STONKS SERVER METHODS --- */

    BrowserServer.prototype.startStonksGame = function() {
        if(Object.keys(this.players).length < 3) {
            App.notify("Need 3+ players for Stonks!", "error");
            return;
        }

        this.stonksData = {
            round: 0,
            scores: {}, 
            roles: {}, 
            stockValue: 10,
            crashLine: 0,
            isLive: false,
            winner: null
        };

        /* Reset scores */
        Object.values(this.players).forEach(p => p.score = 0);

        SoundManager.sfx('start');
        SoundManager.stopMenuMusic();
        
        /* FIX: Manually hide the Lobby on Host Screen */
        const lobby = document.getElementById('host-lobby');
        if(lobby) lobby.classList.add('hidden');
        
        /* SHOW OVERLAY NOW (Game Started) */
        StonksVisuals.setOverlayVisible(true);
        StonksVisuals.updateOverlay("STONKS OR BRONKS", "Market Opening...");
        StonksVisuals.updateHUD(this.players, {}); // Init empty HUD

        this.nextStonksRound();
    };

    BrowserServer.prototype.nextStonksRound = function() {
        this.stonksData.round++;
        
        if (this.stonksData.round > STONKS_CONFIG.rounds) {
            this.endStonksGame();
            return;
        }

        /* Assign Roles */
        const playerIds = Object.keys(this.players);
        const playerCount = playerIds.length;
        
        const pumperIdx = (this.stonksData.round - 1) % playerCount;
        const casherIdx = (this.stonksData.round) % playerCount;
        const crasherIdx = (this.stonksData.round + 1) % playerCount;

        const pumperId = playerIds[pumperIdx];
        const casherId = playerIds[casherIdx];
        const crasherId = playerIds[crasherIdx];

        this.stonksData.roles = {
            [pumperId]: 'PUMPER',
            [casherId]: 'CASHER',
            [crasherId]: 'CRASHER'
        };

        playerIds.forEach(id => {
            if (!this.stonksData.roles[id]) this.stonksData.roles[id] = 'SPECTATOR';
        });

        /* Reset Round State */
        this.stonksData.stockValue = 10;
        this.stonksData.crashLine = 0;
        this.stonksData.isLive = false;
        this.stonksData.winner = null;

        /* Notify Clients */
        this.broadcast('STONKS_ROUND_PREP', {
            round: this.stonksData.round,
            totalRounds: STONKS_CONFIG.rounds,
            roles: this.stonksData.roles,
            pumperName: this.players[pumperId].name,
            casherName: this.players[casherId].name,
            crasherName: this.players[crasherId].name
        });

        StonksVisuals.resetGraph();
        StonksVisuals.updateOverlay("ROUND " + this.stonksData.round, "Get Ready!");
        
        // UPDATE HUD WITH NEW ROLES
        StonksVisuals.updateHUD(this.players, this.stonksData.roles);

        setTimeout(() => {
            this.startStonksLoop();
        }, 4000);
    };

    BrowserServer.prototype.startStonksLoop = function() {
        this.stonksData.isLive = true;
        this.broadcast('STONKS_GO', {});
        StonksVisuals.updateOverlay("", ""); 

        if (this.stonksInterval) clearInterval(this.stonksInterval);
        
        this.stonksInterval = setInterval(() => {
            if (!this.stonksData.isLive) return;

            /* Auto mechanics */
            // FIX: REMOVED AUTOMATIC STOCK RISE (PUMPER CONTROL ONLY)
            // this.stonksData.stockValue += STONKS_CONFIG.baseRise;
            
            // FIX: REMOVED AUTOMATIC CRASH LINE RISE
            // This ensures the "Crasher" player has 100% control over the red line.
            // this.stonksData.crashLine += (this.stonksData.stockValue * 0.02); 

            if (this.stonksData.crashLine >= this.stonksData.stockValue) {
                this.handleStonksCrash();
            }

            StonksVisuals.updateGraph(this.stonksData.stockValue, this.stonksData.crashLine);

        }, STONKS_CONFIG.tickRate);
    };

    BrowserServer.prototype.handleStonksCrash = function() {
        this.stonksData.isLive = false;
        clearInterval(this.stonksInterval);
        SoundManager.sfx('timeup'); 
        
        /* Scoring: Crasher wins */
        const crasherId = Object.keys(this.stonksData.roles).find(key => this.stonksData.roles[key] === 'CRASHER');
        if (this.players[crasherId]) {
            this.players[crasherId].score += 500; 
        }

        StonksVisuals.crashEffect();
        StonksVisuals.updateOverlay("MARKET CRASHED!", "Crasher Wins!");
        
        // UPDATE HUD SCORES
        StonksVisuals.updateHUD(this.players, this.stonksData.roles);
        
        setTimeout(() => this.showStonksScore(), 4000);
    };

    BrowserServer.prototype.handleStonksCashout = function() {
        this.stonksData.isLive = false;
        clearInterval(this.stonksInterval);
        SoundManager.sfx('reveal'); 
        
        const profit = Math.floor(this.stonksData.stockValue);
        
        /* Scoring: Casher gets profit */
        const casherId = Object.keys(this.stonksData.roles).find(key => this.stonksData.roles[key] === 'CASHER');
        if (this.players[casherId]) {
            this.players[casherId].score += profit;
        }

        /* Pumper gets commission */
        const pumperId = Object.keys(this.stonksData.roles).find(key => this.stonksData.roles[key] === 'PUMPER');
        if (this.players[pumperId]) {
            this.players[pumperId].score += Math.floor(profit * 0.1);
        }

        StonksVisuals.updateOverlay("CASHED OUT!", `$${profit} PROFIT`);

        // UPDATE HUD SCORES
        StonksVisuals.updateHUD(this.players, this.stonksData.roles);
        
        setTimeout(() => this.showStonksScore(), 4000);
    };

    BrowserServer.prototype.showStonksScore = function() {
        const leaderboard = Object.values(this.players).sort((a,b) => b.score - a.score);
        this.broadcast('ROUND_RESULTS', { leaderboard });
        setTimeout(() => this.nextStonksRound(), 6000);
    };

    BrowserServer.prototype.endStonksGame = function() {
        // 1. Ensure the Host Game container is visible (so index.html can render leaderboard into it)
        const hostGame = document.getElementById('host-game');
        if (hostGame) hostGame.classList.remove('hidden');

        // 2. Clear the Stonks 3D overlay text so it doesn't block the HTML leaderboard
        StonksVisuals.updateOverlay("", ""); 
        // Hide HUD on end
        StonksVisuals.setOverlayVisible(false);

        // 3. Broadcast Game Over (Triggers leaderboard display on Host & Phones)
        const leaderboard = Object.values(this.players).sort((a,b) => b.score - a.score);
        this.broadcast('GAME_OVER', { leaderboard });
        
        // 4. Wait 10 seconds, then reset everyone to main menu
        setTimeout(() => {
            this.broadcast('RESET_GAME', {}); // Commands clients to reload
            location.reload(); // Reloads host
        }, 10000);
    };

    /* --- INTERCEPTING PLAYER INPUTS --- */
    const originalHandleData = BrowserServer.prototype.handleData;

    BrowserServer.prototype.handleData = function(peerId, data) {
        if (data.type === 'STONKS_ACTION' && this.stonksData && this.stonksData.isLive) {
            const role = this.stonksData.roles[peerId];
            
            if (role === 'PUMPER' && data.payload === 'PUMP') {
                this.stonksData.stockValue += STONKS_CONFIG.pumpPower;
            } else if (role === 'CRASHER' && data.payload === 'DUMP') {
                this.stonksData.crashLine += STONKS_CONFIG.crashPower;
            } else if (role === 'CASHER' && data.payload === 'SELL') {
                this.handleStonksCashout();
            }
            return;
        }
        originalHandleData.apply(this, arguments);
    };


    /* ==========================================
       3. CLIENT HIJACKING (PLAYER UI)
       ========================================== */

    const originalHandlePlayerMsg = App.handlePlayerMsg;

    App.handlePlayerMsg = function(msg) {
        if (msg.type === 'STONKS_ROUND_PREP') {
            /* FIX: Don't use App.show(), toggle internal views manually to keep screen-player visible */
            document.getElementById('screen-player').classList.remove('hidden'); // Ensure parent is visible
            
            document.getElementById('player-vote').classList.add('hidden');
            document.getElementById('player-leaderboard').classList.add('hidden');
            document.getElementById('player-waiting').classList.add('hidden');
            document.getElementById('player-login').classList.add('hidden'); // Safe check
            document.getElementById('player-input').classList.remove('hidden');

            const myRole = msg.payload.roles[this.myPeerId];
            const container = document.getElementById('player-input');
            container.innerHTML = '';

            const wrapper = document.createElement('div');
            wrapper.className = 'flex flex-col items-center justify-center h-full gap-4';
            
            let html = `<div class="text-center mb-4">
                <div class="text-sm text-gray-400">ROUND ${msg.payload.round}/${msg.payload.totalRounds}</div>
                <div class="text-3xl font-bold text-white mb-2">ROLE ASSIGNMENT</div>
            `;

            if (myRole === 'PUMPER') {
                html += `<div class="text-5xl mb-4">📈</div><h2 class="text-green-400 text-4xl font-black">PUMPER</h2><p>MASH THE BUTTON TO RAISE VALUE!</p>`;
            } else if (myRole === 'CRASHER') {
                html += `<div class="text-5xl mb-4">📉</div><h2 class="text-red-500 text-4xl font-black">CRASHER</h2><p>MASH THE BUTTON TO CRASH MARKET!</p>`;
            } else if (myRole === 'CASHER') {
                html += `<div class="text-5xl mb-4">💰</div><h2 class="text-yellow-400 text-4xl font-black">CASHER</h2><p>WATCH HOST SCREEN. SELL HIGH!</p>`;
            } else {
                html += `<div class="text-5xl mb-4">🍿</div><h2 class="text-gray-400 text-4xl font-black">SPECTATOR</h2><p>Enjoy the chaos.</p>`;
            }
            html += `</div>`;

            if (myRole !== 'SPECTATOR') {
                // FIX: Added data-role attribute to store role securely
                html += `<button id="stonk-btn" data-role="${myRole}" disabled class="w-full h-48 rounded-3xl text-4xl font-black shadow-lg transform transition-all active:scale-95 disabled:opacity-50 disabled:bg-gray-700 bg-gray-600 text-gray-300">WAIT...</button>`;
            }

            wrapper.innerHTML = html;
            container.appendChild(wrapper);
            return;
        }

        if (msg.type === 'STONKS_GO') {
            const btn = document.getElementById('stonk-btn');
            if (btn) {
                btn.disabled = false;
                
                // FIX: Get role from data attribute
                const role = btn.dataset.role;

                // --- MOBILE SUPPORT FIX ---
                // Helper to trigger action on both Click and TouchStart (Zero Latency)
                const triggerAction = (e) => {
                    // Prevent default to stop ghost clicks/zooming
                    if (e && e.cancelable) e.preventDefault(); 
                    if (btn.disabled) return;

                    // Send Action
                    let actionType = '';
                    if (role === 'PUMPER') actionType = 'PUMP';
                    else if (role === 'CRASHER') actionType = 'DUMP';
                    else if (role === 'CASHER') actionType = 'SELL';
                    
                    if(actionType) {
                        this.conn.send({ type: 'STONKS_ACTION', payload: actionType });
                        
                        // Haptic Feedback
                        if(navigator.vibrate) navigator.vibrate(role === 'CASHER' ? 200 : 50);

                        // Visual Feedback (simulated press)
                        btn.style.transform = "scale(0.95)";
                        setTimeout(() => btn.style.transform = "scale(1)", 50);

                        // Casher Logic (One time use)
                        if (role === 'CASHER') {
                            btn.disabled = true;
                            btn.innerText = "SOLD!";
                            // Change style to indicate disabled
                            btn.className = btn.className.replace('bg-yellow-400', 'bg-gray-600').replace('border-yellow-600', 'border-gray-700');
                        }
                    }
                };

                if (role === 'PUMPER') {
                    btn.className = 'w-full h-64 rounded-3xl text-5xl font-black shadow-xl transform transition-all active:scale-90 bg-green-500 text-white border-b-8 border-green-700 select-none touch-manipulation';
                    btn.innerText = "PUMP! 📈";
                } else if (role === 'CRASHER') {
                    btn.className = 'w-full h-64 rounded-3xl text-5xl font-black shadow-xl transform transition-all active:scale-90 bg-red-600 text-white border-b-8 border-red-800 select-none touch-manipulation';
                    btn.innerText = "DUMP! 📉";
                } else if (role === 'CASHER') {
                    btn.className = 'w-full h-64 rounded-3xl text-5xl font-black shadow-xl transform transition-all active:scale-90 bg-yellow-400 text-black border-b-8 border-yellow-600 select-none touch-manipulation';
                    btn.innerText = "SELL! 💰";
                }

                // Bind BOTH events for max compatibility + speed
                btn.ontouchstart = triggerAction;
                btn.onclick = triggerAction;
            }
            return;
        }

        originalHandlePlayerMsg.apply(this, arguments);
    };


    /* ==========================================
       4. HOST VISUALS (THREE.JS)
       ========================================== */

    const StonksVisuals = {
        scene: null,
        camera: null,
        renderer: null,
        line: null,
        crashLine: null,
        points: [],
        crashPoints: [],
        maxPoints: 100,
        textOverlay: null,
        hudContainer: null, // NEW: HUD Container
        rolePanel: null,    // NEW: Role List
        scorePanel: null,   // NEW: Score Bar
        currentStockVal: 10, 

        init: function() {
            try {
                const hostScreen = document.getElementById('screen-host');
                const old = document.getElementById('three-stonks');
                if (old) old.remove();

                const container = document.createElement('div');
                container.id = 'three-stonks';
                container.className = 'absolute inset-0 pointer-events-none';
                container.style.zIndex = '0'; 
                
                hostScreen.insertBefore(container, hostScreen.firstChild);

                this.scene = new THREE.Scene();
                this.scene.background = new THREE.Color(0x0f172a); 
                const grid = new THREE.GridHelper(200, 20, 0x1e293b, 0x1e293b);
                grid.rotation.x = Math.PI / 2;
                this.scene.add(grid);

                // FIX: Massive Far Plane to prevent clipping at high stock values
                this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
                this.camera.position.set(50, 20, 50);

                this.renderer = new THREE.WebGLRenderer({ antialias: true });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                container.appendChild(this.renderer.domElement);

                const materialGreen = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 });
                const geometryGreen = new THREE.BufferGeometry();
                this.line = new THREE.Line(geometryGreen, materialGreen);
                // FIX: Disable culling to prevent flickering
                this.line.frustumCulled = false;
                this.scene.add(this.line);

                const materialRed = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
                const geometryRed = new THREE.BufferGeometry();
                this.crashLine = new THREE.Line(geometryRed, materialRed);
                this.crashLine.frustumCulled = false;
                this.scene.add(this.crashLine);

                /* Create Overlay but keep it HIDDEN initially */
                this.textOverlay = document.createElement('div');
                this.textOverlay.className = 'absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-50';
                this.textOverlay.style.display = 'none'; 
                this.textOverlay.innerHTML = '<h1 class="text-6xl font-black text-white drop-shadow-lg" id="stonk-main-text"></h1><h2 class="text-4xl font-bold text-yellow-400 mt-4" id="stonk-sub-text"></h2>';
                container.appendChild(this.textOverlay);

                /* NEW: HUD OVERLAY (Roles Left, Scores Center) */
                this.hudContainer = document.createElement('div');
                this.hudContainer.className = 'absolute inset-0 pointer-events-none z-40'; // Below main text but above graph
                this.hudContainer.style.display = 'none';

                // 1. Roles Panel (Top Left)
                this.rolePanel = document.createElement('div');
                this.rolePanel.className = 'absolute top-6 left-6 flex flex-col gap-3 bg-slate-900/80 p-4 rounded-xl border border-white/10 backdrop-blur-md shadow-2xl min-w-[200px]';
                this.hudContainer.appendChild(this.rolePanel);

                // 2. Score Panel (Top Center)
                this.scorePanel = document.createElement('div');
                this.scorePanel.className = 'absolute top-6 left-1/2 -translate-x-1/2 flex gap-6 bg-slate-900/80 p-4 rounded-full border border-white/10 backdrop-blur-md shadow-2xl';
                this.hudContainer.appendChild(this.scorePanel);

                container.appendChild(this.hudContainer);

                this.animate();
            } catch (e) {
                console.error("ThreeJS Init Error:", e);
            }
        },

        setOverlayVisible: function(visible) {
            if (this.textOverlay) {
                this.textOverlay.style.display = visible ? 'flex' : 'none';
            }
            if (this.hudContainer) {
                this.hudContainer.style.display = visible ? 'block' : 'none';
            }
        },

        // NEW: Update HUD Information
        updateHUD: function(players, roles) {
            if (!this.rolePanel || !this.scorePanel) return;

            // --- UPDATE ROLES ---
            let roleHTML = '<h3 class="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1 border-b border-gray-700 pb-2">Active Roles</h3>';
            let activeRolesFound = false;

            Object.keys(roles).forEach(peerId => {
                const player = players[peerId];
                if (!player) return;
                const role = roles[peerId];
                
                let color = 'text-gray-400';
                let icon = '';
                if (role === 'PUMPER') { color = 'text-green-400'; icon = '📈'; }
                else if (role === 'CRASHER') { color = 'text-red-400'; icon = '📉'; }
                else if (role === 'CASHER') { color = 'text-yellow-400'; icon = '💰'; }
                
                if (role !== 'SPECTATOR') {
                     activeRolesFound = true;
                     roleHTML += `<div class="${color} font-bold text-base flex items-center gap-2">
                        <span class="text-xl">${icon}</span> 
                        <span class="truncate max-w-[150px]">${player.name}</span>
                        <span class="text-xs text-gray-500 ml-auto uppercase tracking-tighter border border-gray-700 px-1 rounded">${role}</span>
                     </div>`;
                }
            });

            if (!activeRolesFound) roleHTML += '<div class="text-gray-500 text-sm italic">Waiting for round...</div>';
            this.rolePanel.innerHTML = roleHTML;

            // --- UPDATE SCORES ---
            let scoreHTML = '';
            const sortedPlayers = Object.values(players).sort((a,b) => b.score - a.score);
            
            // Limit to top 5 visually to fit bar
            sortedPlayers.slice(0, 5).forEach(p => {
                // Highlight active players in score bar? Maybe subtle border.
                const role = roles[p.id];
                let ringClass = 'border-transparent';
                if (role === 'PUMPER') ringClass = 'border-green-500';
                else if (role === 'CRASHER') ringClass = 'border-red-500';
                else if (role === 'CASHER') ringClass = 'border-yellow-400';

                scoreHTML += `<div class="flex flex-col items-center w-16 md:w-20">
                    <div class="avatar-blob w-8 h-8 text-sm mb-1 border-2 ${ringClass}">${p.avatar}</div>
                    <span class="text-xs text-gray-400 truncate w-full text-center font-bold">${p.name}</span>
                    <span class="text-lg font-display text-white">${p.score}</span>
                </div>`;
            });
            this.scorePanel.innerHTML = scoreHTML;
        },

        resetGraph: function() {
            this.points = [];
            this.crashPoints = [];
            for(let i=0; i<this.maxPoints; i++) {
                this.points.push(new THREE.Vector3(i, 10, 0));
                this.crashPoints.push(new THREE.Vector3(i, 0, 0));
            }
            this.currentStockVal = 10;
            this.updateGeometries();
            this.camera.position.set(50, 30, 60);
            this.camera.lookAt(50, 20, 0);
        },

        updateGraph: function(stockVal, crashVal) {
            // Save for smooth camera in animate loop
            this.currentStockVal = stockVal;

            for (let i = 0; i < this.maxPoints - 1; i++) {
                this.points[i].y = this.points[i+1].y;
                this.crashPoints[i].y = this.crashPoints[i+1].y;
            }
            this.points[this.maxPoints - 1].y = stockVal;
            this.crashPoints[this.maxPoints - 1].y = crashVal;
            this.updateGeometries();
        },

        updateGeometries: function() {
            if(this.line) this.line.geometry.setFromPoints(this.points);
            if(this.crashLine) this.crashLine.geometry.setFromPoints(this.crashPoints);
        },

        crashEffect: function() {
            this.scene.background = new THREE.Color(0x450a0a);
        },

        updateOverlay: function(main, sub) {
            const m = document.getElementById('stonk-main-text');
            const s = document.getElementById('stonk-sub-text');
            if (m) m.innerText = main;
            if (s) s.innerText = sub;
        },

        animate: function() {
            requestAnimationFrame(() => this.animate());
            
            // SMOOTH CAMERA TRACKING LOGIC (60FPS)
            if (this.camera && this.currentStockVal) {
                const headX = 50; 
                const headY = this.currentStockVal;
                
                // Target: Above and slightly back
                // Zoom out (increase Z) as stock goes higher to keep context
                const targetY = headY + 30;
                const targetZ = 60 + (headY * 0.05); // Dynamic Zoom Out

                // Smooth Lerp
                this.camera.position.y += (targetY - this.camera.position.y) * 0.1;
                this.camera.position.z += (targetZ - this.camera.position.z) * 0.1;

                // Always look directly at the stock head
                this.camera.lookAt(headX, headY, 0);
            }

            if (this.renderer) this.renderer.render(this.scene, this.camera);
        }
    };

    /* ==========================================
       5. INITIALIZATION TRIGGER
       ========================================== */

    const setupListener = () => {
        const btnStart = document.getElementById('btn-start');
        const selector = document.getElementById('game-selector');

        if (btnStart && selector) {
            selector.addEventListener('change', () => {
                if (selector.value === 'GAME2') {
                    const opt = selector.querySelector('option[value="GAME2"]');
                    if (opt) opt.innerText = "Stonks or Bronks";

                    StonksVisuals.init();
                    StonksVisuals.resetGraph();
                    
                    /* KEY FIX: Ensure Overlay is HIDDEN in Lobby */
                    StonksVisuals.setOverlayVisible(false);
                    StonksVisuals.updateOverlay("", ""); 
                } else {
                    const el = document.getElementById('three-stonks');
                    if(el) el.remove();
                }
            });
        } else {
            setTimeout(setupListener, 500);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupListener);
    } else {
        setupListener();
    }

})();