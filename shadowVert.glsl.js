export default `#version 300 es

uniform mat4 uModel;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uLightView;
uniform mat4 uLightProjection;
uniform vec4 uColor;
uniform vec3 uLightDir;
uniform float uHasNormals;

in vec3 position;
in vec3 normal;

out vec4 vColor;
out vec4 vLightSpacePos;

void main() {
    // TODO: If has normals, compute color considering it
    // TODO: compute light space position and gl_Position
    vec3 lightdir = normalize(uLightDir);
    float dotp = max(0.25, dot(lightdir,normal));

    if(uHasNormals == 2.0){
        vec4 visibleColor = vec4(dotp*uColor.rgb, uColor.a );
        vColor = visibleColor;
    }else if(uHasNormals == 1.0){
        // vec4 visibleColor = vec4(dotp*uColor.rgb, uColor.a );
        vColor = uColor;
    }

    vLightSpacePos = uLightProjection * uLightView * vec4(position, 1.0);

    gl_Position = uProjection * uView * uModel * vec4(position, 1.0);
}
`;