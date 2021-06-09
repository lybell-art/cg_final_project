import * as THREE from './libs/three.module.js';
import { UnrealBloomPass } from './libs/plugins/UnrealBloomPass.js';

class CelestalSphere
{
	initialize()
	{
		this.hull=new THREE.Group();
		this.stars={};
	}
	add(word, lumen)
	{
		this.stars[word]=new StarWord(word, lumen);
		this.stars[word].attach(this.hull);
	}
	changeLumen(word, lumen)
	{
		this.stars[word].changeLumen(lumen);
	}
}

function makeTextMaterial(text)
{
	const canvas=document.createElement('canvas');
}

class StarWord
{
	initialize(word, lumen)
	{
		this.word=word;
		this._lumen=lumen;
		this.geometry = new THREE.BufferGeometry();
		this.material = new THREE.PointsMaterial({size: this.lumen*5, vertexColors: true});
		this.mesh=new THREE.Points(geometry, material);
	}
	get lumen()
	{
		return Math.log10(this._lumen);
	}
	attach(parent)
	{
		if(this.mesh instanceof THREE.Object3D)
		{
			parent.add(this.mesh);
		}
	}
	changeLumen(lumen)
	{
		this._lumen = lumen;
	}
}

export { CelestalSphere, StarWord };