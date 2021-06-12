import * as THREE from './libs/three.module.js';
import { MTLLoader } from './libs/plugins/MTLLoader.js';
import { OBJLoader } from './libs/plugins/OBJLoader.js';

import { geolocation, initCommon, getMouseSphereLocation, myLoadingComplete } from './common.js';
import { CelestalSphere, StarWord, StarParticle } from './star.js';

const socket = io();

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 2400);
const renderer = new THREE.WebGLRenderer({antialias:true});
const container = document.getElementById("canvas");

//objects
const celestalSphere = new CelestalSphere(scene);
const starParticle = new StarParticle();
let cannonGroup = new THREE.Group();

//controller
const gyro = 90.0;

const clock = new THREE.Clock();


function initCannonLauncher(loader)
{
	const mtlLoader= new MTLLoader(loader);
	const objLoader= new OBJLoader(loader);

	mtlLoader.load( 'assets/cannon.mtl', function ( materials ) {
		materials.preload();
		objLoader.setMaterials( materials );
		objLoader.load( 'assets/cannon.obj', function ( object ) {
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

	mtlLoader.load( 'assets/cannon_wheel.mtl', function ( materials ) {
		materials.preload();
		objLoader.setMaterials( materials );
		objLoader.load( 'assets/cannon_wheel.obj', function ( object ) {
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

function rotateCannon(r)
{
	const launcher = cannonGroup.getObjectByName("cannon");;
	if(launcher instanceof THREE.Object3D)
	{
		console.log(launcher.rotation);
		launcher.rotation.x = (r - 90)*Math.PI/180;
	}
}

/*
class cameraMover
{
	constructor()
	{
		this.camera=camera;
		
		this.cameraScene=0;
	}
	move()
	{
		switch(this.cameraScene)
		{
			case 0:
		}
	}
}*/

function init()
{
	camera.position.set(0, 160, 300);

	scene.background = new THREE.Color(0x000000);

	starParticle.attach(celestalSphere.hull);

	const loader=new THREE.LoadingManager(myLoadingComplete);
	initCommon(scene, loader);
//const ambient = new THREE.AmbientLight( 0xcccccc ); // soft white light
//	scene.add( ambient );
	initCannon(loader);

	//renderer setting
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	container.appendChild( renderer.domElement );

	setEventListeners();
	console.log(geolocation);
}
function animate()
{
	requestAnimationFrame( animate );
	const deltaTime = Math.min( 0.1, clock.getDelta() );
	const elapsedTime = clock.getElapsedTime();
	starParticle.twinkle(elapsedTime * 0.5);
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
}

//dom event
function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
}





function updateAngle(e)
{
	gyro=e.beta;
}

function launch_star(e)
{
	const myStar=document.getElementById("my_star");
	console.log(myStar.value);
	if(myStar.value == "") return;
	socket.emit('launch_star', myStar.value, gyro, geolocation);
	myStar.value="";
}

socket.on('initialize_star', function(db){
	for(let i=0;i<db.length;i++)
	{
		let d=db[i];
		celestalSphere.add(d.word,d.count);
	}
});

document.getElementById("test_button").addEventListener('click',launch_star);

window.addEventListener("deviceOrientation", updateAngle);