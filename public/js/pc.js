import * as THREE from './libs/three.module.js';
import { EffectComposer } from './libs/plugins/EffectComposer.js';
import { RenderPass } from './libs/plugins/RenderPass.js';
import { ShaderPass } from './libs/plugins/ShaderPass.js'
import { UnrealBloomPass } from './libs/plugins/UnrealBloomPass.js';
import { SMAAPass } from './libs/plugins/SMAAPass.js';


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
let starLines
let earth=null;

//controller
let isMousePressed=false, isRightMousePressed=false;
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

class StarLines
{
	static material = new THREE.LineBasicMaterial({color: 0xffefac});
	constructor(parent)
	{
		this.lines=[];
		this.startPos = new THREE.Vector3();
		let geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array(2 * 3), 3 ) );

		this.currentLine=new THREE.Line( geometry, StarLines.material );
		this.currentLine.layers.enable(1);
		this.currentLine.visible=false;
		this.parent = parent;
		this.isDrawing=false;
		parent.add(this.currentLine);
	}
	initDraw(pos, mousePos)
	{
		this.startPos.copy(pos);

		let lineVert = this.currentLine.geometry.attributes.position.array;
		lineVert[0]=pos.x;
		lineVert[1]=pos.y;
		lineVert[2]=pos.z;
		lineVert[3]=mousePos.x;
		lineVert[4]=mousePos.y;
		lineVert[5]=mousePos.z;
		this.currentLine.geometry.attributes.position.needsUpdate = true;
		this.currentLine.visible=true;

		this.isDrawing=true;
	}
	moveCursor(pos)
	{
		if(!this.isDrawing) return;

		let lineVert = this.currentLine.geometry.attributes.position.array;
		lineVert[3]=pos.x;
		lineVert[4]=pos.y;
		lineVert[5]=pos.z;
		this.currentLine.geometry.attributes.position.needsUpdate = true;
	}
	fixLine(pos)
	{
		if(!this.isDrawing) return false;
		if(pos.equals(this.startPos)) return false;
		this.moveCursor(pos);

		let geometry = new THREE.BufferGeometry();
		let posArr = [this.startPos.x, this.startPos.y, this.startPos.z, pos.x, pos.y, pos.z];
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( posArr, 3 ) );

		const newLine=new THREE.Line( geometry, StarLines.material );
		newLine.layers.enable(1);
		this.lines.push(newLine);
		this.parent.add(newLine);

		this.isDrawing=false;
		return true;
	}
	endDraw()
	{
		this.currentLine.visible=false;
		this.currentLine.geometry.attributes.position.needsUpdate = true;
		this.isDrawing=false;
	}
	clearAllLines()
	{
		this.endDraw();
		this.tempVertexes=[];
		for(let i=0;i<this.lines.length;i++)
		{
			scene.remove(this.lines[i]);
		}
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

	const smaaPass = new SMAAPass( window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio() );

	finalComposer.addPass( renderScene );
	finalComposer.addPass( finalPass );
//	finalComposer.addPass( smaaPass );


	bloomComposer.setSize( window.innerWidth, window.innerHeight );
	finalComposer.setSize( window.innerWidth, window.innerHeight );
}


function init()
{
	camera.position.set(0, 160, 450);

	scene.background = new THREE.Color(0x000000);

	starParticle.attach(celestalSphere.hull);

	initCommon(scene);
	starLines=new StarLines(celestalSphere.hull);

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

	let button2=document.getElementById('screenshot_button');
	button2.addEventListener('mousedown', saveScreenshot);
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
	let isRightButton;
	if ("which" in e)  // Gecko (Firefox), WebKit (Safari/Chrome) & Opera
		isRightButton = e.which == 3; 
	else if ("button" in e)  // IE, Opera 
		isRightButton = e.button == 2; 

	if(isRightButton) isRightMousePressed=true;
	else isMousePressed=true;

	let _pickedStar = celestalSphere.pickStar(camera, mousePos);
	if(isMousePressed) pickedStar=_pickedStar;
	else
	{
		console.log("right Mouse Pressed!");
		if(_pickedStar != null)
		{
			let mouseSpherePos = getMouseSphereLocation(camera, mousePos, 800);
			mouseSpherePos.applyMatrix4(celestalSphere.invMatrix);

			starLines.initDraw(_pickedStar.obj.position, mouseSpherePos);
		}
	}

//	shooters.push(new wordShooter("test", 45, geolocation, 1));
//	right click interaction
}

function onMouseDrag(e)
{
	let delta=new THREE.Vector2(e.movementX, e.movementY);
	mousePos.x = e.clientX - window.innerWidth /2;
	mousePos.y = -(e.clientY - window.innerHeight/2);

	if(isMousePressed) //left mouse dragging
	{
		if(pickedStar != null) celestalSphere.dragStar(pickedStar.obj, camera, mousePos, pickedStar.mouseDist);
		else celestalSphere.rotate(delta.x / 5, delta.y / 5);
	}
	if(isRightMousePressed) // right mouse dragging
	{
		let _pickedStar = celestalSphere.pickStar(camera, mousePos);
		let mouseSpherePos = getMouseSphereLocation(camera, mousePos, 800);
		mouseSpherePos.applyMatrix4(celestalSphere.invMatrix);

		if(_pickedStar != null)
		{
			let isFixed=starLines.fixLine(_pickedStar.obj.position);
			if(isFixed) starLines.initDraw(_pickedStar.obj.position, mouseSpherePos);
		}

		starLines.moveCursor(mouseSpherePos);
	}

	//debug cursor
	let spLoc=getMouseSphereLocation(camera, mousePos, 800);
	if(spLoc != null) testsphere.position.copy(spLoc);
}

function onMousePressEnd(e)
{
	let isRightButton;
	if ("which" in e)  // Gecko (Firefox), WebKit (Safari/Chrome) & Opera
		isRightButton = e.which == 3; 
	else if ("button" in e)  // IE, Opera 
		isRightButton = e.button == 2; 

	if(isRightButton)
	{
		starLines.endDraw();
		isRightMousePressed=false;
	}
	else isMousePressed=false;

	pickedStar=null;
}

function saveScreenshot()
{
	isMousePressed=false;
	isRightMousePressed=false;

	renderer.preserveDrawingBuffer = true;
	render();
	let img=renderer.domElement.toDataURL('image/png');
	console.log(renderer.domElement);
	const virtualLink=document.createElement('a');
	virtualLink.href=img;
	virtualLink.download='Our Own Stars';
	virtualLink.click();
	renderer.preserveDrawingBuffer = false;
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