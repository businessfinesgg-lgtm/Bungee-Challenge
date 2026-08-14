/* v99 MoveNet classic Web Worker */

let detector = null;
let ready = false;
let frameCanvas = null;
let frameCtx = null;

function loadDependencies() {
    importScripts(
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.22.0/dist/tf-core.min.js",
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@4.22.0/dist/tf-converter.min.js",
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tf-backend-wasm.min.js",
        "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js"
    );
}

async function init() {
    loadDependencies();

    if (
        typeof tf === "undefined" ||
        typeof poseDetection === "undefined"
    ) {
        throw new Error(
            "TFJS/MoveNet nie załadował się w Workerze"
        );
    }

    if (
        tf.wasm?.setWasmPaths
    ) {
        tf.wasm.setWasmPaths(
            "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/"
        );
    }

    if (
        tf.wasm?.setThreadsCount
    ) {
        try {
            tf.wasm.setThreadsCount(1);
        } catch (_) {}
    }

    await tf.setBackend(
        "wasm"
    );

    await tf.ready();

    detector =
        await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            {
                modelType:
                    poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
                // Nasz kontroler ma własne filtrowanie medianą + EMA.
                // Wyłączenie smoothingu MoveNet zmniejsza opóźnienie reakcji.
                enableSmoothing:false
            }
        );

    ready = true;
}

function extractMetric(pose, width, height) {
    const keypoints =
        pose?.keypoints;

    if (!keypoints?.length) {
        return null;
    }

    const byName =
        Object.fromEntries(
            keypoints
                .filter(k => k?.name)
                .map(k => [
                    k.name,
                    k
                ])
        );

    const ls =
        byName.left_shoulder;

    const rs =
        byName.right_shoulder;

    const minScore = .32;

    if (
        !ls ||
        !rs ||
        (ls.score ?? 0) < minScore ||
        (rs.score ?? 0) < minScore
    ) {
        return null;
    }

    return {
        leftX:
            ls.x / width,
        leftY:
            ls.y / height,
        leftScore:
            ls.score ?? 1,

        rightX:
            rs.x / width,
        rightY:
            rs.y / height,
        rightScore:
            rs.score ?? 1
    };
}

self.onmessage =
    async event => {
        const data =
            event.data || {};

        if (
            data.type ===
            "init"
        ) {
            try {
                await init();

                self.postMessage({
                    type:"ready"
                });
            } catch (error) {
                self.postMessage({
                    type:"init-error",
                    message:
                        error?.message ||
                        String(error)
                });
            }

            return;
        }

        if (
            data.type !== "frame" ||
            !data.bitmap ||
            !ready ||
            !detector
        ) {
            return;
        }

        const bitmap =
            data.bitmap;

        try {
            if (
                !frameCanvas ||
                frameCanvas.width !==
                    bitmap.width ||
                frameCanvas.height !==
                    bitmap.height
            ) {
                frameCanvas =
                    new OffscreenCanvas(
                        bitmap.width,
                        bitmap.height
                    );

                frameCtx =
                    frameCanvas.getContext(
                        "2d",
                        {
                            alpha:false,
                            desynchronized:true
                        }
                    );
            }

            frameCtx.drawImage(
                bitmap,
                0,
                0
            );

            const width =
                bitmap.width;

            const height =
                bitmap.height;

            bitmap.close?.();

            const poses =
                await detector.estimatePoses(
                    frameCanvas,
                    {
                        flipHorizontal:false,
                        maxPoses:1
                    }
                );

            const metric =
                extractMetric(
                    poses?.[0],
                    width,
                    height
                );

            self.postMessage({
                type:"result",
                timestamp:
                    data.timestamp,
                metric
            });
        } catch (error) {
            try {
                bitmap.close?.();
            } catch (_) {}

            self.postMessage({
                type:"frame-error",
                message:
                    error?.message ||
                    String(error)
            });
        }
    };
