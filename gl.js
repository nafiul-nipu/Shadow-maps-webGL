import layerVertShaderSrc from './layerVert.glsl.js';
import layerFragShaderSrc from './layerFrag.glsl.js';
import shadowFragShaderSrc from './shadowFrag.glsl.js';
import shadowVertShaderSrc from './shadowVert.glsl.js';
import depthFragShaderSrc from './depthFrag.glsl.js';
import depthVertShaderSrc from './depthVert.glsl.js';

var gl;

var layers = null
var renderToScreen = null;
var fbo = null;
var currRotate = 0;
var currLightRotate = 0;
var currLightDirection = null;
var currZoom = 0;
var currProj = 'perspective';
var currResolution = 2048;
var displayShadowmap = false;

/*
    FBO
*/
class FBO {
    constructor(size) {
        // TODO: Create FBO and texture with size
        // create texture and create fbo from utils.js
        this.size = size

        this.shadowDepthTexture = createTexture2D(gl, this.size, this.size, gl.DEPTH_COMPONENT32F, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null, gl.NEAREST, gl.NEAREST, gl.REPEAT, gl.REPEAT);

        // this.shadowFramebuffer = gl.createFramebuffer()
        // gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer)

        this.shadowFramebuffer = createFBO(gl, gl.DEPTH_ATTACHMENT, this.shadowDepthTexture);


    }

    start() {
        // TODO: Bind FBO, set viewport to size, clear depth buffer
        // gl.bindFrameBuffer (gl.FRAMEBUFFER, deptBuffer)
        // gl setviewport = size of texture
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer)
        gl.viewport(0,0,this.size,this.size)
        gl.clearDepth(1.0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    }

    stop() {
        // TODO: unbind FBO
        gl.bindFramebuffer(gl.FRAMEBUFFER,  null);
        
    }
}

/*
    Shadow map
*/
class ShadowMapProgram {
    constructor() {
        this.vertexShader = createShader(gl, gl.VERTEX_SHADER, shadowVertShaderSrc);
        this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, shadowFragShaderSrc);
        this.program = createProgram(gl, this.vertexShader, this.fragmentShader);

        this.posAttribLoc = gl.getAttribLocation(this.program, "position");
        this.colorAttribLoc = gl.getUniformLocation(this.program, "uColor");
        this.modelLoc = gl.getUniformLocation(this.program, "uModel");
        this.projectionLoc = gl.getUniformLocation(this.program, "uProjection");
        this.viewLoc = gl.getUniformLocation(this.program, "uView");
        this.lightViewLoc = gl.getUniformLocation(this.program, "uLightView");
        this.lightProjectionLoc = gl.getUniformLocation(this.program, "uLightProjection");
        this.samplerLoc = gl.getUniformLocation(this.program, "uSampler");
        this.hasNormalsAttribLoc = gl.getUniformLocation(this.program, "uHasNormals");
        this.lightDirAttribLoc = gl.getUniformLocation(this.program, "uLightDir");    
    }

    use() {
        // TODO: use program
        gl.useProgram(this.program);
    }
}

/*
    Render to screen program
*/
class RenderToScreenProgram {
    constructor() {
        this.vertexShader = createShader(gl, gl.VERTEX_SHADER, depthVertShaderSrc);
        this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, depthFragShaderSrc);
        
        this.program = createProgram(gl, this.vertexShader, this.fragmentShader);
        this.posAttribLoc = gl.getAttribLocation(this.program, "position");
        this.samplerLoc = gl.getUniformLocation(this.program, "uSampler");

        // TODO: Create quad VBO and VAO
        // this.vao = createVAO(gl, 0, this.vertexBuffer);
    }

    draw(texture) {
        // TODO: Render quad and display texture
    }

}

/*
    Layer program
*/
class LayerProgram {
    constructor() {
        this.vertexShader = createShader(gl, gl.VERTEX_SHADER, layerVertShaderSrc);
        this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, layerFragShaderSrc);
        this.program = createProgram(gl, this.vertexShader, this.fragmentShader);

        this.posAttribLoc = gl.getAttribLocation(this.program, "position");
        this.colorAttribLoc = gl.getUniformLocation(this.program, "uColor");
        this.modelLoc = gl.getUniformLocation(this.program, "uModel");
        this.projectionLoc = gl.getUniformLocation(this.program, "uProjection");
        this.viewLoc = gl.getUniformLocation(this.program, "uView");
    }

    use() {
        gl.useProgram(this.program);
    }
}


/*
    Collection of layers
*/
class Layers {
    constructor() {
        this.layers = {};
        this.centroid = [0,0,0];
    }


    addLayer(name, vertices, indices, color, normals) {
        if(normals == undefined)
            normals = null;
        var layer = new Layer(vertices, indices, color, normals);
        layer.init();
        this.layers[name] = layer;
        this.centroid = this.getCentroid();
    }

    removeLayer(name) {
        delete this.layers[name];
    }

    draw(modelMatrix, viewMatrix, projectionMatrix, lightViewMatrix = null, lightProjectionMatrix = null, shadowPass = false, texture = null) {
        for(var layer in this.layers) {
            if(layer == 'surface') {
                gl.polygonOffset(1, 1);
            }
            else {
                gl.polygonOffset(0, 0);
            }
            this.layers[layer].draw(modelMatrix, viewMatrix, projectionMatrix, lightViewMatrix, lightProjectionMatrix, shadowPass, texture);
        }
    }

    
    getCentroid() {
        var sum = [0,0,0];
        var numpts = 0;
        for(var layer in this.layers) {
            numpts += this.layers[layer].vertices.length/3;
            for(var i=0; i<this.layers[layer].vertices.length; i+=3) {
                var x = this.layers[layer].vertices[i];
                var y = this.layers[layer].vertices[i+1];
                var z = this.layers[layer].vertices[i+2];
    
                sum[0]+=x;
                sum[1]+=y;
                sum[2]+=z;
            }
        }
        return [sum[0]/numpts,sum[1]/numpts,sum[2]/numpts];
    }

}

/*
    Layers without normals (water, parks, surface)
*/
class Layer {
    constructor(vertices, indices, color, normals = null) {
        this.vertices = vertices;
        this.indices = indices;
        this.color = color;
        this.normals = normals;

        this.hasNormals = 1.0;
        if(this.normals) {
            this.hasNormals = 2.0;
        }
    }

    init() {
        this.layerProgram = new LayerProgram();
        this.shadowProgram = new ShadowMapProgram();

        this.vertexBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this.vertices));
        this.indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.indices));

        if(this.normals) {
            this.normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this.normals));
            this.vao = createVAO(gl, 0, this.vertexBuffer, 1, this.normalBuffer);
        }
        else {
            this.vao = createVAO(gl, 0, this.vertexBuffer);
        }
    }

    draw(modelMatrix, viewMatrix, projectionMatrix, lightViewMatrix, lightProjectionMatrix, shadowPass = false, texture = null) {
        // TODO: Handle shadow pass (using ShadowMapProgram) and regular pass (using LayerProgram)
        // if shadowPass == true:
    // use gl.uniform... for all matrices
    // where are we using update for all matrices? - in the global draw function
    // else
    // layers.draw(modelMatrix, viewMatrix, projectionmatrix, texture (?))
    // don t create the fbo in draw
    // draw is called every single frame
    // reuse the same fbo every frame
        if(shadowPass == false){
            // regular pass
            this.layerProgram.use();
            gl.uniformMatrix4fv(this.layerProgram.modelLoc, false, new Float32Array(modelMatrix));
            gl.uniformMatrix4fv(this.layerProgram.projectionLoc, false, new Float32Array(lightProjectionMatrix));
            gl.uniformMatrix4fv(this.layerProgram.viewLoc, false, new Float32Array(lightViewMatrix));
            gl.uniform4fv(this.layerProgram.colorAttribLoc, this.color);
            gl.bindVertexArray(this.vao);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_INT, 0);   
        }else{
            // shadowpass
            // this.posAttribLoc = gl.getAttribLocation(this.program, "position");
            // this.colorAttribLoc = gl.getUniformLocation(this.program, "uColor");
            // this.modelLoc = gl.getUniformLocation(this.program, "uModel");
            // this.projectionLoc = gl.getUniformLocation(this.program, "uProjection");
            // this.viewLoc = gl.getUniformLocation(this.program, "uView");
            // this.lightViewLoc = gl.getUniformLocation(this.program, "uLightView");
            // this.lightProjectionLoc = gl.getUniformLocation(this.program, "uLightProjection");
            // this.samplerLoc = gl.getUniformLocation(this.program, "uSampler");
            // this.hasNormalsAttribLoc = gl.getUniformLocation(this.program, "uHasNormals");
            // this.lightDirAttribLoc = gl.getUniformLocation(this.program, "uLightDir"); 

            this.shadowProgram.use()
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(this.shadowProgram.samplerLoc, 0);
            gl.uniformMatrix4fv(this.shadowProgram.modelLoc, false, new Float32Array(modelMatrix));
            gl.uniformMatrix4fv(this.shadowProgram.projectionLoc, false, new Float32Array(projectionMatrix));
            gl.uniformMatrix4fv(this.shadowProgram.viewLoc, false, new Float32Array(viewMatrix));
            gl.uniform4fv(this.shadowProgram.colorAttribLoc, this.color);
            gl.uniformMatrix4fv(this.shadowProgram.lightProjectionLoc, false, new Float32Array(lightProjectionMatrix));
            gl.uniformMatrix4fv(this.shadowProgram.lightViewLoc, false, new Float32Array(lightViewMatrix));
            gl.uniform1f(this.shadowProgram.hasNormalsAttribLoc, this.hasNormals)
            gl.uniform3fv(this.shadowProgram.lightDirAttribLoc, new Float32Array(currLightDirection))
            gl.bindVertexArray(this.vao);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_INT, 0); 
        }

    }
}

/*
    Event handlers
*/
window.updateRotate = function(dx, canvas) {
    // currRotate = parseInt(document.querySelector("#rotate").value);
    currRotate += (dx / canvas.width) * 360
}

window.updateLightRotate = function() {
    currLightRotate = parseInt(document.querySelector("#lightRotate").value);
}

window.updateZoom = function(evt) {
    // currZoom = parseFloat(document.querySelector("#zoom").value);
    currZoom += evt.deltaY * -0.02;
    currZoom = Math.min(Math.max(1, currZoom), 100);
}

window.updateProjection = function() {
    currProj = document.querySelector("#projection").value;
}

window.displayShadowmap = function(e) {
    displayShadowmap = e.checked;
}

/*
    File handler
*/
window.handleFile = function(e) {
    var reader = new FileReader();
    reader.onload = function(evt) {
        var parsed = JSON.parse(evt.target.result);
        for(var layer in parsed){
            var aux = parsed[layer];
            layers.addLayer(layer, aux['coordinates'], aux['indices'], aux['color'], aux['normals']);
        }
    }
    reader.readAsText(e.files[0]);
}

/*
    Update transformation matrices
*/
function updateModelMatrix(centroid) {
    var modelMatrix = identityMatrix()
    return modelMatrix;
    // should rotate the model around the centroid of the model 
    // if not identity matrix then we need at least one rotation trasdormation
}

function updateProjectionMatrix() {
    // far value tends to infinity for shadow volumes; idk if i need this
    var aspect = window.innerWidth /  window.innerHeight;
    if(currProj == 'perspective'){
        var projectionMatrix = perspectiveMatrix(35 * Math.PI / 180.0, aspect, 1, 50000);
    }else{
        var temp = 2500 - (currZoom/100.0) * 2500 * 0.99
         var projectionMatrix = orthographicMatrix(-aspect * temp, aspect * temp, -1*temp, 1*temp, -1*temp, 50000);
        //  projectionMatrix = orthographicMatrix(-aspect, aspect, -1, 1, -1, 50000);
    }

    return projectionMatrix;
}

function updateViewMatrix(centroid){
    var radRotate = currRotate * Math.PI / 180.0;
    var maxZoom = 5000;
    var radius = maxZoom - (currZoom/100.0)*maxZoom*0.99;
    var x = radius * Math.cos(radRotate);
    var y = radius * Math.sin(radRotate);
    var viewMatrix = lookAt(add(centroid, [x,y,radius]), centroid, [0,0,1])
    return viewMatrix;
}

function updateLightViewMatrix(centroid) {
    // TODO: Light view matrix

    // var lightViewMatrix = lookAt([0,2,-3], centroid, currLightDirection);

    var radRotate = currLightRotate * Math.PI / 180.0;
    var maxZoom = 5000;
    var radius = 500;
    var x = radius * Math.cos(radRotate);
    var y = radius * Math.sin(radRotate);
    var adding = add(centroid, [x,y,radius]);
    // console.log(adding)

    var lightViewMatrix = lookAt(adding, centroid, [0,0,1]);
    // console.log(lightViewMatrix)
    currLightDirection = sub(adding, centroid);

    return lightViewMatrix;
}

function updateLightProjectionMatrix() {
    // TODO: Light projection matrix
    // var lightProjectionMatrix = perspectiveMatrix(35 * Math.PI / 180.0, aspect, 1, 1000);
    var temp = 3000
    var lightProjectionMatrix = orthographicMatrix(-temp, temp, -temp, temp, -2500, 5000);

    return lightProjectionMatrix;
}

/*
    Main draw function (should call layers.draw)
*/
function draw() {

    gl.clearColor(190/255, 210/255, 215/255, 1);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // TODO: First rendering pass, rendering using FBO
    // we need this - first pass
    // layers.draw at least twice
    // layers.draw(modelMatrix, viewMatrix, projectionMatrix, lightViewMatrix, lightProjectionMatrix, shadowPass, texture);           
    
    var modelMatrix = updateModelMatrix(layers.centroid);
    var lightViewMatrix = updateLightViewMatrix(layers.centroid);
    var lightProjectionMatrix = updateLightProjectionMatrix();
    var viewMatrix = updateViewMatrix(layers.centroid)
    var projectionMatrix = updateProjectionMatrix()
    
    fbo.start();
    layers.draw(modelMatrix, viewMatrix, projectionMatrix, lightViewMatrix, lightProjectionMatrix);
    fbo.stop();
    // console.log(fbo.texture)


    if(!displayShadowmap) {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // task 6 - no need to implement this if we don't wwant to

        // TODO: Second rendering pass, render to screen
        // var modelMatrix = updateModelMatrix(layers.centroid);
        // var lightViewMatrix = updateLightViewMatrix(layers.centroid);
        // var lightProjectionMatrix = updateLightProjectionMatrix();
        // var viewMatrix = updateViewMatrix(layers.centroid)
        // var projectionMatrix = updateProjectionMatrix()
        layers.draw(modelMatrix, viewMatrix, projectionMatrix, lightViewMatrix, lightProjectionMatrix, true, fbo.shadowDepthTexture);

    }
    else {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // TODO: Render shadowmap texture computed in first pass
        // we need this - second pass
        // call layers.draw somehow
        // layers.draw(modelMatrix, .., shadowPass = false...);
    }

    requestAnimationFrame(draw);

}

/*
    Initialize everything
*/
function initialize() {

    var canvas = document.querySelector("#glcanvas");
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    gl = canvas.getContext("webgl2");

    // var depth_texture_extension = gl.getExtension('WEBGL_depth_texture');
    // console.log(depth_texture_extension)

    var prevX;
    // var prevY;
    canvas.addEventListener('mousedown', function(evt){
        evt.preventDefault();
        var x = evt.clientX;
        // var y = evt.clientY;
        var rect = canvas.getBoundingClientRect();
        prevX = x - rect.left;
        // prevY = y - rect.top;


    })
    canvas.addEventListener("mousemove", function(evt) {
        evt.preventDefault();
        var rect = canvas.getBoundingClientRect();
        var x = evt.clientX - rect.left;
        // var y = evt.clientY - rect.top;
        if(evt.buttons == 1){
            var dx = x - prevX;
            // var dy = y - prevY;
            window.updateRotate(dx, canvas)
        }

        prevX = x;
        // prevY = y;        
    });

    canvas.addEventListener("wheel", function(evt) {
        evt.preventDefault();
        window.updateZoom(evt)
    });

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);

    gl.enable(gl.POLYGON_OFFSET_FILL);

    layers = new Layers();
    fbo = new FBO(currResolution);
    renderToScreen = new RenderToScreenProgram();

    window.requestAnimationFrame(draw);

}


window.onload = initialize;