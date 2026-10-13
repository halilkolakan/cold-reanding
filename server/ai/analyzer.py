import contextlib
import json
import os
import sys

import cv2
from deepface import DeepFace


def analyze_video(video_path):
    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        raise ValueError(f"Video açılamadı: {video_path}")

    fps = capture.get(cv2.CAP_PROP_FPS)
    frame_interval = max(1, round(fps)) if fps > 0 else 1
    frame_index = 0
    analyzed_frames = 0
    emotion_counts = {}
    emotion_scores = {}

    try:
        while True:
            success, frame = capture.read()
            if not success:
                break

            if frame_index % frame_interval == 0:
                with contextlib.redirect_stdout(sys.stderr):
                    result = DeepFace.analyze(
                        img_path=frame,
                        actions=["emotion"],
                        enforce_detection=False,
                        silent=True,
                    )

                face_results = result if isinstance(result, list) else [result]
                face_results = [
                    face for face in face_results if isinstance(face, dict)
                ]
                if face_results:
                    emotions = [
                        face.get("emotion", {}) for face in face_results
                    ]
                    emotions = [
                        emotion for emotion in emotions if emotion
                    ]
                    if emotions:
                        averaged_scores = {
                            emotion: sum(scores.get(emotion, 0) for scores in emotions)
                            / len(emotions)
                            for emotion in {
                                key for scores in emotions for key in scores
                            }
                        }
                        dominant = max(
                            averaged_scores, key=averaged_scores.get
                        )
                        emotion_counts[dominant] = (
                            emotion_counts.get(dominant, 0) + 1
                        )
                        for emotion, score in averaged_scores.items():
                            emotion_scores[emotion] = (
                                emotion_scores.get(emotion, 0) + float(score)
                            )
                        analyzed_frames += 1

            frame_index += 1
    finally:
        capture.release()

    if analyzed_frames == 0:
        raise ValueError("Videoda analiz edilebilir kare veya yüz bulunamadı.")

    average_emotions = {
        emotion: round(float(score) / analyzed_frames, 2)
        for emotion, score in emotion_scores.items()
    }
    dominant_emotion = max(emotion_counts, key=emotion_counts.get)

    return {
        "status": "success",
        "video": os.path.basename(video_path),
        "sampledFrames": analyzed_frames,
        "dominantEmotion": dominant_emotion,
        "emotionCounts": emotion_counts,
        "averageEmotionScores": average_emotions,
    }


def main():
    if len(sys.argv) != 2:
        raise ValueError("Kullanım: python analyzer.py <video_dosya_yolu>")

    print(json.dumps(analyze_video(sys.argv[1]), ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(
            json.dumps(
                {"status": "error", "message": str(error)},
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )
        sys.exit(1)
