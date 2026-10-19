import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei/native';
import { Asset } from 'expo-asset';
import { Box3, Vector3 } from 'three';

const GLOW_LAYERS = [
  { radius: 1.35, opacity: 0.035, color: '#0284c7' },
  { radius: 1.05, opacity: 0.045, color: '#0284c7' },
  { radius: 0.72, opacity: 0.055, color: '#38bdf8' },
];

function Model({ rotationY, rotationVelocity }) {
  const [modelUri, setModelUri] = useState(null);
  const meshRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAsset() {
      try {
        const [{ localUri, uri }] = await Asset.loadAsync(
          require('../assets/model.glb'),
        );
        if (isMounted) {
          setModelUri(localUri || uri);
        }
      } catch (err) {
        console.error('Model yükleme hatası:', err);
      }
    }

    void loadAsset();
    return () => {
      isMounted = false;
    };
  }, []);

  useFrame((_, delta) => {
    rotationY.current += (0.18 + rotationVelocity.current) * delta;
    rotationVelocity.current *= Math.exp(-2.5 * delta);

    if (meshRef.current) {
      meshRef.current.rotation.y = rotationY.current;
    }
  });

  if (!modelUri) {
    return null;
  }

  return <PrimitiveModel uri={modelUri} meshRef={meshRef} />;
}

function PrimitiveModel({ uri, meshRef }) {
  const { scene } = useGLTF(uri);
  const { camera, size } = useThree();
  const modelTransform = useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(scene);
    const dimensions = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const verticalFov = (camera.fov * Math.PI) / 180;
    const visibleHeight =
      2 * Math.abs(camera.position.z) * Math.tan(verticalFov / 2);
    const visibleWidth = visibleHeight * (size.width / size.height);
    const horizontalSpan = Math.hypot(dimensions.x, dimensions.z);
    const fitScale = Math.min(
      (visibleHeight * 0.68) / dimensions.y,
      (visibleWidth * 0.76) / horizontalSpan,
    );

    return {
      scale: fitScale,
      position: [
        -center.x * fitScale,
        -center.y * fitScale,
        -center.z * fitScale,
      ],
    };
  }, [camera, scene, size.height, size.width]);

  return (
    <primitive
      ref={meshRef}
      object={scene}
      scale={modelTransform.scale}
      position={modelTransform.position}
    />
  );
}

function TargetingBackdrop() {
  return (
    <group position={[0, 0, -1.1]}>
      {GLOW_LAYERS.map((layer) => (
        <mesh key={layer.radius} position={[0, 0, -0.03]}>
          <circleGeometry args={[layer.radius, 64]} />
          <meshBasicMaterial
            color={layer.color}
            transparent
            opacity={layer.opacity}
            depthWrite={false}
          />
        </mesh>
      ))}

      <mesh>
        <torusGeometry args={[1.12, 0.008, 6, 96]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.88, 0.004, 6, 96]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.65} />
      </mesh>

      {[
        { position: [0, 1.22, 0], size: [0.16, 0.012, 0.012] },
        { position: [0, -1.22, 0], size: [0.16, 0.012, 0.012] },
      ].map((mark) => (
        <mesh key={mark.position[1]} position={mark.position}>
          <boxGeometry args={mark.size} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      ))}

      {[
        { position: [1.22, 0, 0], size: [0.012, 0.16, 0.012] },
        { position: [-1.22, 0, 0], size: [0.012, 0.16, 0.012] },
      ].map((mark) => (
        <mesh key={mark.position[0]} position={mark.position}>
          <boxGeometry args={mark.size} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      ))}
    </group>
  );
}

export default function CyberFaceViewer() {
  const rotationY = useRef(0);
  const rotationVelocity = useRef(0);
  const previousTouchX = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        previousTouchX.current = evt.nativeEvent.pageX;
        rotationVelocity.current = 0;
      },
      onPanResponderMove: (evt) => {
        const currentX = evt.nativeEvent.pageX;
        const deltaX = currentX - previousTouchX.current;
        rotationY.current += deltaX * 0.015;
        rotationVelocity.current = Math.max(
          -1.8,
          Math.min(1.8, deltaX * 0.15),
        );
        previousTouchX.current = currentX;
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Canvas
          camera={{ position: [0, 0, 4.5], fov: 45 }}
          style={styles.canvas}
        >
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[5, 5, 5]}
            color="#38bdf8"
            intensity={2}
          />
          <pointLight
            position={[-5, -3, -2]}
            color="#0284c7"
            intensity={1.5}
          />

          <TargetingBackdrop />
          <Suspense fallback={null}>
            <Model
              rotationY={rotationY}
              rotationVelocity={rotationVelocity}
            />
          </Suspense>
        </Canvas>
      </View>
      <Text style={styles.status}>
        [ SYSTEM: COLD_READING_ACTIVE // TARGET_ACQUIRED ]
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  canvasContainer: {
    width: '100%',
    height: 220,
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  status: {
    marginTop: 2,
    color: '#38bdf8',
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
