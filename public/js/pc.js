import * as THREE from './libs/three.module.js';
import { EffectComposer } from './libs/plugins/EffectComposer.js';
import { RenderPass } from './libs/plugins/RenderPass.js';
import { ShaderPass } from './libs/plugins/ShaderPass.js'
import { UnrealBloomPass } from './libs/plugins/UnrealBloomPass.js';


import { geolocation, initCommon, getMouseSphereLocation } from './common.js';
import { CelestalSphere, StarWord, StarParticle, LaunchParticle } from './star.js';


const socket = io();

//scene & renderer
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 2400);
const renderer = new THREE.WebGLRenderer({antialias:true});
const container = document.getElementById("canvas");

//objects
const celestalSphere = new CelestalSphere(scene);
const starParticle = new StarParticle();
const shooters = [], generatingStarWords = [];
let earth=null;

//controller
let isMousePressed=false;
let mousePos=new THREE.Vector2();
let pickedStar=null;

let testsphere;

const clock = new THREE.Clock();

//postprocessing
const darkMaterial = new THREE.MeshBasicMaterial( { color: 0x000000 } ); //for avoiding overlay
const storedMaterials = {};

const bloomLayer = new THREE.Layers();
bloomLayer.set( 1 );
const bloomComposer = new EffectComposer( renderer );
const finalComposer = new EffectComposer( renderer );

function testBall()
{
	const geometry = new THREE.SphereGeometry( 5, 32, 32 );
	const material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
	testsphere = new THREE.Mesh( geometry, material );
	scene.add( testsphere );
}

class wordShooter
{
	constructor(word, angle, loc, lumen)
	{
		const deg=Math.PI/180;
		let startPos=new THREE.Vector3();
		startPos.setFromSphericalCoords(90, (90-loc.latitude) * deg, (-loc.longitude) * deg);

		let rotateAngle=new THREE.Euler(-(90 - geolocation.latitude ) * deg , geolocation.longitude * deg, 0);
		startPos.applyEuler(rotateAngle); 

		let newAngle=THREE.MathUtils.clamp(angle, 0, 90);

		let direction=new THREE.Vector3(0,Math.sin(angle * deg), -Math.cos(angle * deg));

		this.word=word;
		this.lumen=lumen;
		this.radius=Math.random() * 200 + 600;

		this.particleSystem=new LaunchParticle(startPos, direction,4);
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


//glow postprocessing
//(source : https://github.com/mrdoob/three.js/blob/master/examples/webgl_postprocessing_unreal_bloom_selective.html)

const composedShader = {
	vertexShader:`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}
	`,
	fragmentShader:`
		uniform sampler2D baseTexture;
		uniform sampler2D bloomTexture;
		varying vec2 vUv;
		void main() {
			gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );
		}
	`
}

function darkenNonBloomed( obj ) {
	if ( obj.isMesh && bloomLayer.test( obj.layers ) === false ) {
		storedMaterials[ obj.uuid ] = obj.material;
		obj.material = darkMaterial;
	}
}

function restoreMaterial( obj ) {
	if ( storedMaterials[ obj.uuid ] ) {
		obj.material = storedMaterials[ obj.uuid ];
		delete storedMaterials[ obj.uuid ];
	}
}

function initPostProcessing()
{
	const renderScene = new RenderPass( scene, camera );

	const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
	bloomPass.threshold = 0;
	bloomPass.strength = 1.5;
	bloomPass.radius = 0;

	bloomComposer.renderToScreen = false;
	bloomComposer.addPass( renderScene );
	bloomComposer.addPass( bloomPass );

	const finalPass = new ShaderPass(
		new THREE.ShaderMaterial( {
			uniforms: {
				baseTexture: { value: null },
				bloomTexture: { value: bloomComposer.renderTarget2.texture }
			},
			vertexShader: composedShader.vertexShader,
			fragmentShader: composedShader.fragmentShader,
			defines: {}
		} ), "baseTexture"
	);
	finalPass.needsSwap = true;

	finalComposer.addPass( renderScene );
	finalComposer.addPass( finalPass );

	bloomComposer.setSize( window.innerWidth, window.innerHeight );
	finalComposer.setSize( window.innerWidth, window.innerHeight );
}


function init()
{
	camera.position.set(0, 160, 450);

	scene.background = new THREE.Color(0x000000);

	starParticle.attach(celestalSphere.hull);

	initCommon(scene);
	testBall();


	//renderer setting
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	initPostProcessing();

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
	render();
}
function render()
{
	scene.traverse( darkenNonBloomed );
	bloomComposer.render();
	scene.traverse( restoreMaterial );
	finalComposer.render();
}
init();
animate();



//set event listeners
function setEventListeners()
{
	window.addEventListener( 'resize', onWindowResize );
	container.addEventListener('mousedown', onMousePressStart);
	container.addEventListener('mousemove', onMouseDrag);
	container.addEventListener('mouseup', onMousePressEnd);
}

//dom event
function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
	bloomComposer.setSize( window.innerWidth, window.innerHeight );
	finalComposer.setSize( window.innerWidth, window.innerHeight );
}

function onMousePressStart(e)
{
	isMousePressed=true;
	pickedStar=celestalSphere.pickStar(camera, mousePos);

	shooters.push(new wordShooter("test", 45, geolocation, 1));
//	right click interaction
}

function onMouseDrag(e)
{
	let delta=new THREE.Vector2(e.movementX, e.movementY);
	mousePos.x = e.clientX - window.innerWidth /2;
	mousePos.y = -(e.clientY - window.innerHeight/2);

	if(isMousePressed) //dragging
	{
		if(pickedStar != null) celestalSphere.dragStar(pickedStar.obj, camera, mousePos, pickedStar.mouseDist);
		else celestalSphere.rotate(delta.x / 5, delta.y / 5);
	}

	//debug cursor
	let spLoc=getMouseSphereLocation(camera, mousePos, 800);
	if(spLoc != null) testsphere.position.copy(spLoc);
}

function onMousePressEnd(e)
{
	isMousePressed=false;
	pickedStar=null;
}


//socket 

socket.on('initialize_star', function(db){
	for(let i=0;i<db.length;i++)
	{
		let d=db[i];
		celestalSphere.add(d.word,d.count);
	}
});

socket.on('broadcast_star', function(msg, angle, loc, lumen){
	if(this.stars[word] === undefined)
	{
		shooters.push(new wordShooter(msg, angle, loc, lumen));
	}
	else celestalSphere.changeLumen(msg, lumen);
//	console.log(starList);
});