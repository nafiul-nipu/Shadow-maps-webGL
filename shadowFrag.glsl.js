export default `#version 300 es
precision highp float;

uniform sampler2D uSampler;

in vec4 vColor;
in vec4 vLightSpacePos;
out vec4 outColor;

vec3 shadowCalculation(vec4 lightSpacePos) {
    // TODO: shadow calculation
    vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
    return projCoords;
}


void main() {
    // TODO: compute shadowmap coordenates 
    // TODO: evaluate if point is in shadow or not
    vec3 coords = shadowCalculation(vLightSpacePos);
    coords = coords * 0.5 + 0.5;
    // float closestDepth = texture(uSampler, coords.xy).r;
    float currentDepth = coords.z;
    float acneRemover = 0.0025;
    float shadow = 0.0;
    vec2 texelsize = vec2(1.0) / vec2(textureSize(uSampler, 0));

    for(int x = -2; x <= 2; ++x)
    {
        for(int y = -2; y <= 2; ++y)
        {
            float texelDepth = texture(uSampler, coords.xy + vec2(x, y) * texelsize).r;

            shadow += currentDepth - acneRemover > texelDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 16.0;

    outColor = vec4((1.0 - shadow*0.5) * vColor.rgb, 1);

}
`;