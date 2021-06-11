import * as THREE from './libs/three.module.js';

import { geolocation, initCommon, getMouseSphereLocation } from './common.js';
import { CelestalSphere, StarWord, StarParticle } from './star.js';

const socket = io();

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 2400);
const renderer = new THREE.WebGLRenderer({antialias:true});
const container = document.getElementById("canvas");

//objects
const celestalSphere = new CelestalSphere(scene);
const starParticle = new StarParticle();
let earth=null;

//controller
const gyro = 90.0;

const clock = new THREE.Clock();


function getGyro()
{
	return 
}

function init()
{
	camera.position.set(0, 160, 450);

	scene.background = new THREE.Color(0x000000);

	starParticle.attach(celestalSphere.hull);

	initCommon(scene);

	//renderer setting
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	container.appendChild( renderer.domElement );

	console.log(geolocation);
}
function animate()
{
	const elapsedTime = clock.getElapsedTime();
	requestAnimationFrame( animate );
	starParticle.twinkle(elapsedTime * 0.5);
	render();
}
function render()
{
	renderer.render( scene, camera);
}
init();
animate();



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