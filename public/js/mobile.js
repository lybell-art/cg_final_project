import * as THREE from './libs/three.module.js';
import { MTLLoader } from './libs/plugins/MTLLoader.js';
import { OBJLoader } from './libs/plugins/OBJLoader.js';
import { Bezier }  from './libs/bezierEasing.js';

import { geolocation, initCommon, getMouseSphereLocation, myLoadingComplete, bgm, isLoaded } from './common.js';
import { CelestalSphere, StarWord, StarParticle, LaunchParticle, makeTextMaterial } from './star.js';

const socket = io();

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 2400);
const renderer = new THREE.WebGLRenderer({antialias:true});
const container = document.getElementById("canvas");

//objects
const celestalSphere = new CelestalSphere(scene);
const starParticle = new StarParticle();
let cannonGroup = new THREE.Group();
let cameraMover;
let cannonSphere;
const shooters = [], generatingStarWords = [];

//controller
let gyro = 90.0;
const canGyroSensor = !!window.DeviceOrientationEvent;
if(canGyroSensor) document.getElementById("gyro_inavailable").remove();
else {document.getElementById("gyro_available").remove(); gyro=45.0;}
const hammertime = new Hammer(container);
hammertime.get('swipe').set({ direction: Hammer.DIRECTION_UP });

//dom controller
let viewingContent = 0;
let introViewingCount = 0;
let myStarWord="";
let isCorrectedSubmitted = false;

const clock = new THREE.Clock();


function initCannonLauncher(loader)
{
	const mtlLoader= new MTLLoader(loader);
	const objLoader= new OBJLoader(loader);

	mtlLoader.load( 'assets/obj/cannon.mtl', function ( materials ) {
		materials.preload();
		objLoader.setMaterials( materials );
		objLoader.load( 'assets/obj/cannon.obj', function ( object ) {
			let cannon=object.children[0];
			cannon.name="cannon";
			cannonGroup.add(cannon);
		});
	});
}

function initCannonWheel(loader)
{
	const mtlLoader= new MTLLoader(loader);
	const objLoader= new OBJLoader(loader);

	mtlLoader.load( 'assets/obj/cannon_wheel.mtl', function ( materials ) {
		materials.preload();
		objLoader.setMaterials( materials );
		objLoader.load( 'assets/obj/cannon_wheel.obj', function ( object ) {
			let cannon_wheel=object.children[0];
			cannonGroup.add(cannon_wheel);
		});
	});
}

function initCannon(loader)
{
	initCannonLauncher(loader);
	initCannonWheel(loader);
	scene.add(cannonGroup);
	cannonGroup.scale.multiplyScalar(4);
	cannonGroup.position.set(0,105,0);
}

function rotateCannon(r, force=false)
{
	const launcher = cannonGroup.getObjectByName("cannon");
	if(launcher instanceof THREE.Object3D)
	{
		let pAngle=launcher.rotation.x;
		let newAngle=(r - 90)*Math.PI/180;
		if(force) launcher.rotation.x = newAngle;
		else launcher.rotation.x = pAngle*0.2 + newAngle*0.8;
	}
}

const ease=Bezier(0.25, 0.1, 0.25, 1);
const ease_in=Bezier(0.42, 0.0, 1.0, 1.0);
const ease_out=Bezier(0.0, 0.0, 0.58, 1.0);
const ease_inout=Bezier(0.38, 0.0, 0.62, 1);

class CameraMover
{
	static LINEAR = 0;
	static EASE = 1;
	static EASE_IN = 2;
	static EASE_OUT = 3;
	static EASE_INOUT = 4;

	static NO_LERP = 100;
	static FORWARD = 101;
	static BACKWARD = 102;
	static LOOP_LERP = 103;
	constructor()
	{
		this.camera=camera;
		
		this.cameraScene=0;
		this.frame=0;
		
		this.isPendingLerp = CameraMover.NO_LERP;
		this.nextScene = 1;

	}
	getInterpolation(mode = CameraMover.LINEAR)
	{
		let f=THREE.MathUtils.clamp(this.frame, 0, 1);
		switch(mode)
		{
			case CameraMover.EASE: f=ease(f); break;
			case CameraMover.EASE_IN: f=ease_in(f); break;
			case CameraMover.EASE_OUT: f=ease_out(f); break;
			case CameraMover.EASE_INOUT: f=ease_inout(f); break;
		}
		return f;
	}
	lerp(s, e, f)
	{
		return s + f*(e-s);
	}
	lerpVector(start, end, mode = CameraMover.LINEAR)
	{
		let v=this.getInterpolation(mode);
		const lerp=(s, e, f)=>s + f*(e-s);
		const res = [0,0,0];
		for(let i=0; i<3; i++)
		{
			res[i]=lerp(start[i], end[i], v);
		}

		return new THREE.Vector3().fromArray(res);
	}
	lerpAngle(start, end, mode = CameraMover.LINEAR)
	{
		let v=this.getInterpolation(mode);
		const lerp=(s, e, f)=>s + f*(e-s);
		return -lerp(start, end, v);
	}
	move()
	{
		let res;
		let r;
		switch(this.cameraScene)
		{
			case 0: //start
				res=this.lerpVector([0, 160, 800], [0, 160, 300], CameraMover.EASE);
				this.camera.position.copy(res);
				break;
			case 1: //idle
				r=this.lerpAngle(0, Math.PI*2, CameraMover.LINEAR);
				res = new THREE.Vector3(0, 160, 300);
				res.applyAxisAngle(new THREE.Vector3(1,0,0), r);
				this.camera.position.copy(res);
				this.camera.rotation.x=r;
				break;
			case 2: //input text 
				res=this.lerpVector([0, 160, 300], [0, 190, 160], CameraMover.EASE);
				r = this.lerpAngle(0, Math.PI/12, CameraMover.EASE);
				this.camera.rotation.x=r;
				this.camera.position.copy(res);
				break;
			case 3: //launch 
				res=this.lerpVector([0, 190, 160], [0, 140, 130], CameraMover.EASE);
				r = this.lerpAngle(Math.PI/12, 0, CameraMover.EASE);
				this.camera.rotation.x=r;
				this.camera.position.copy(res);
				break;
			case 4: //launch2
				res=this.lerpVector([0, 140, 130], [0, 110, 140], CameraMover.EASE);
				r = this.lerpAngle(0, -Math.PI/16, CameraMover.EASE);
				this.camera.rotation.x=r;
				this.camera.position.copy(res);
				break;
			case 5: //reset
				res=this.lerpVector([0, 110, 140], [0, 160, 300], CameraMover.EASE_INOUT);
				r = this.lerpAngle(-Math.PI/16, 0, CameraMover.EASE_INOUT);
				this.camera.rotation.x=r;
				this.camera.position.copy(res);
				break;
		}
	}
	frameForward(delta)
	{
		const speed=[0.5, 0.01, 1.0, 1.0, 1.0, 1.0];

		if(this.isPendingLerp == CameraMover.FORWARD) this.frame += 10 * delta * speed[this.cameraScene];
		else if(this.isPendingLerp == CameraMover.BACKWARD) this.frame -=  10 * delta * speed[this.cameraScene];
		else this.frame += speed[this.cameraScene]* delta;

		let isLerpEnded=false;

		switch(this.isPendingLerp)
		{
			case CameraMover.NO_LERP:
				if(this.frame >= 1.0)
				{
					this.frame = 1.0;
					isLerpEnded=true;
				}
				break;
			case CameraMover.FORWARD:
				if(this.frame >= 1.0)
				{
					this.frame = 0.0;
					this.cameraScene = this.nextScene;
					this.isPendingLerp = CameraMover.NO_LERP;
					isLerpEnded=true;
				}
				break;
			case CameraMover.BACKWARD:
				if(this.frame <= 0.0)
				{
					this.frame = 0.0;
					this.cameraScene = this.nextScene;
					this.isPendingLerp = CameraMover.NO_LERP;
					isLerpEnded=true;
				}
				break;
			case CameraMover.LOOP_LERP:
				if(this.frame >= 1.0) this.frame -= 1.0;
				break;
		}
		return isLerpEnded;
	}
	update(delta)
	{
		let isLerpEnded=this.frameForward(delta);
		this.move();
		if(isLerpEnded)
		{
			switch(this.cameraScene)
			{
				case 0:
				case 5:
					this.callScene(1, CameraMover.LOOP_LERP); break;
			}
		}
	}
	callScene(scene, lerpMode=CameraMover.NO_LERP)
	{
		this.isPendingLerp=lerpMode;
		this.nextScene = scene;
		if(lerpMode == CameraMover.NO_LERP || lerpMode == CameraMover.LOOP_LERP )
		{
			this.frame=0;
			this.cameraScene = scene;
			return;
		}
	}
}

class CannonSphereMover
{
	constructor(scene)
	{
		this.word="";
		this.frame=0;

		const geometry = new THREE.SphereGeometry( 3, 32, 32 );

		const texData= makeTextMaterial("", "#ffefac");
		this.texture = texData.tex;
		this.material=new THREE.MeshBasicMaterial({
			map:this.texture, 
			color:0xffffff, 
			transparent:true});
		this.mesh=new THREE.Mesh(geometry, this.material);
		scene.add(this.mesh);

		this.visible=false;
		this.z=160;
	}
	get visible()
	{
		return this.mesh.visible;
	}
	get z()
	{
		return this.mesh.position.y;
	}
	set visible(v)
	{
		this.mesh.visible=!!v;
	}
	set z(a)
	{
		this.mesh.position.y = a;
	}
	active(word)
	{
		const texData= makeTextMaterial(word, "#ffefac");
		this.texture = texData.tex;
		this.material.map = this.texture;
		this.visible=true;
		this.z=180;
	}
	update(delta)
	{
		if(this.visible)
		{
			this.frame +=delta * 0.25;
			let v=ease_inout(this.frame);

			const lerp=(s, e, f)=>s + f*(e-s);

			this.z = lerp(180, 110, v);

			if(this.frame > 1.0)
			{
				this.frame = 0.0;
				this.z=180;
				this.visible=false;
			}
		}
	}
}

class wordShooter
{
	constructor(word, angle, lumen)
	{
		const deg=Math.PI/180;
		let startPos=new THREE.Vector3(0,105, -0);

		let newAngle=THREE.MathUtils.clamp(angle, 0, 90);

		let direction=new THREE.Vector3(0,Math.sin(angle * deg), -Math.cos(angle * deg));

		this.word=word;
		this.lumen=lumen;
		this.radius=800;

		this.particleSystem=new LaunchParticle(startPos, direction, 1, 12, 0.15, 4, true);
		this.particleSystem.attach(scene);

	}
	update(delta)
	{
		this.particleSystem.thrust();
		this.particleSystem.update(delta);
		if(this.particleSystem.position.length() > this.radius)
		{
			let hitPoint = this.particleSystem.position;
			hitPoint.applyMatrix4(celestalSphere.invMatrix);
			const newStar=celestalSphere.add(this.word, this.lumen, hitPoint, true);
			if(newStar != null) generatingStarWords.push(newStar);
			this.particleSystem.callDestroy();
		}
		return this.particleSystem.isDead;
	}
}

//dom contents view

function showContents(i)
{
	if(viewingContent == i) return;
	else if(viewingContent != 0 ) hideContents(viewingContent);

	let id=((i>=3) ? "mov_" : "") + "page"+i;
	const content=document.getElementById(id);
	if(content == null) return;
	content.classList.remove("hidden");
	viewingContent=i;
}

function hideContents(i)
{
	let id=((i>=3) ? "mov_" : "") + "page"+i;
	const content=document.getElementById(id);
	if(content == null) return;
	content.classList.add("hidden");
	viewingContent=0;
}

function introView(time)
{
	if(introViewingCount == 0 && time>1)
	{
		showContents(1);
		introViewingCount++;
	}
	else if(introViewingCount == 1 && time>3.5)
	{
		hideContents(1);
		introViewingCount++;
	}
	else if(introViewingCount == 2 && time>5.5)
	{
		showContents(2);
		introViewingCount++;
	}
	else if(introViewingCount == 3 && time>8)
	{
		hideContents(2);
		introViewingCount++;
	}
	else if(introViewingCount == 4 && time>10)
	{
		showContents(3);
		introViewingCount++;
	}
}

function progressLaunchParticles(deltaTime)
{
	//animate word shooter particle systems
	const deadShooterIndices=[];
	for(let i=0; i<shooters.length; i++)
	{
		let isDead=false;
		isDead=shooters[i].update(deltaTime);
		if(isDead) deadShooterIndices.push(i);
	}
	for(let j=deadShooterIndices.length-1; j>=0; j--)
	{
		shooters.splice(deadShooterIndices[j], 1);
	}

	//animate new star words
	
	const deadStarIndices=[];
	for(let i=0; i<generatingStarWords.length; i++)
	{
		generatingStarWords[i].update(deltaTime);
		if(generatingStarWords[i].isTransition == false) deadStarIndices.push(i);
	}
	for(let j=deadStarIndices.length-1; j>=0; j--)
	{
		generatingStarWords.splice(deadStarIndices[j], 1);
	}
}

function init()
{
	cameraMover=new CameraMover(camera);
	cameraMover.update(0);

	scene.background = new THREE.Color(0x000000);

	starParticle.attach(celestalSphere.hull);

	const loader=new THREE.LoadingManager(function()
		{
			myLoadingComplete();
			clock.start();
		});
	initCommon(scene, loader);
	initCannon(loader);
	cannonSphere=new CannonSphereMover(scene);

	//renderer setting
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	container.appendChild( renderer.domElement );

	setEventListeners();
}
function animate()
{
	requestAnimationFrame( animate );
	const deltaTime = Math.min( 0.1, clock.getDelta() );
	const elapsedTime = clock.getElapsedTime();
	starParticle.twinkle(elapsedTime * 0.5);
	if(isLoaded)
	{
		cameraMover.update(deltaTime);
		cannonSphere.update(deltaTime);
		progressLaunchParticles(deltaTime);
		if(introViewingCount < 5) introView(elapsedTime);
		if(!canGyroSensor) updateAngle({beta:null});
	}
//	rotateCannon(elapsedTime * 10);
	render();
}
function render()
{
	renderer.render( scene, camera);
}
init();
animate();


//set event listeners
function setEventListeners()
{
	window.addEventListener( 'resize', onWindowResize );
	window.addEventListener('focus', bgmReplay);
	window.addEventListener('blur', bgmPause);
//	window.addEventListener('touchstart', (e)=>{ shooters.push(new wordShooter('test', 90, 1)); });

	let button=document.getElementById('shoot-button');
	button.addEventListener('touchstart', typeStart);

	let myForm=document.getElementById('input_star');

	const inputForm=document.getElementById("my_star");
	const inputVisual=document.getElementById("inputRenderBox");
	inputForm.addEventListener('input', (e)=> inputVisual.textContent = e.target.value );

	inputForm.onblur =function()
	{
		inputForm.value="";
		inputVisual.textContent = "";
		if(!isCorrectedSubmitted) // submit falled
		{
			cameraMover.callScene(1, CameraMover.BACKWARD);
			showContents(3);
		}
		else // submit success
		{
			cameraMover.callScene(3, CameraMover.FORWARD);
			showContents(5);

		}
		isCorrectedSubmitted=false;
	}

	myForm.addEventListener('submit', (e)=>{
		myStarWord=inputForm.value;
		if(myStarWord != "") isCorrectedSubmitted=true;
		inputForm.blur();
		cannonSphere.active(myStarWord);
		setTimeout(function() {
			cameraMover.callScene(4, CameraMover.FORWARD);
			showContents(6);
		}, 2000);
		e.preventDefault();
	}
	);

	window.addEventListener('keydown',(e)=>
	{
		if(e.key == "2") cameraMover.callScene(2, CameraMover.BACKWARD);
		if(e.key == "3") cameraMover.callScene(3, CameraMover.FORWARD);
		if(e.key == "4") cameraMover.callScene(4, CameraMover.FORWARD);
		if(e.key == "5") cameraMover.callScene(5, CameraMover.NO_LOOP);
//		if(e.key == "4") cannonSphere.active("dimi");
	});

	hammertime.on('swipeup', function(e){
		if(viewingContent == 6) launch_star();
	});
}

//dom event
function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
}

function bgmPause()
{
	if(!bgm.isPlaying) return;
	bgm.pause();
}

function bgmReplay()
{
	if(bgm.isPlaying) return;
	bgm.play();
}


function typeStart(e)
{
	if(viewingContent == 3)
	{
		cameraMover.callScene(2, CameraMover.BACKWARD);
		showContents(4);
		const myStar=document.getElementById("my_star");
		myStar.focus();
		for(let i=0;i<10; i++) myStar.click();
	}
	e.preventDefault();
}



function updateAngle(e)
{
	if(viewingContent != 6)
	{
		rotateCannon(90.0, true);
		return;
	}
	gyro=e.beta;
	if(gyro != null)
	{
		rotateCannon(gyro);
		socket.emit('debug', gyro);
	}
	else
	{
		gyro=45.0;
		rotateCannon(45.0);
	}
	
}

function launch_star(e)
{
	if(myStarWord != "")
	{
//		socket.emit('debug', myStarWord);
//		socket.emit('debug', gyro);
//		socket.emit('debug', geolocation);
		shooters.push(new wordShooter(myStarWord, gyro, 1));
		socket.emit('launch_star', {text : myStarWord, gyro:gyro, loc:geolocation});
	}

	setTimeout(function() {
		rotateCannon(90.0, true);
		cameraMover.callScene(5, CameraMover.NO_LOOP);
		showContents(3);
	}, 2000);

}

socket.on('initialize_star', function(db){
	for(let i=0;i<db.length;i++)
	{
		let d=db[i];
		celestalSphere.add(d.word,d.count);
	}
});

//document.getElementById("test_button").addEventListener('click',launch_star);

window.addEventListener("deviceorientation", updateAngle);