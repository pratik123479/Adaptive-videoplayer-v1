import "./App.css";
import { useRef, useState, useEffect } from "react";
import videoFile from "./assets/loud_voice_test.mp4";

function App() {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const gainNodeRef = useRef(null);

  const animationRef = useRef(null);
  const hideControlsTimer = useRef(null);

  // Stores the user's selected volume
  const volumeRef = useRef(1);

  // Stores loud state in real time
  const loudStateRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);

  const [audioLevel, setAudioLevel] = useState(0);
  const [audioValue, setAudioValue] = useState("-∞ dB");

  const [isTooLoud, setIsTooLoud] = useState(false);

  // Shows actual adaptive gain
  const [adaptiveGain, setAdaptiveGain] = useState(100);

  // -------------------------
  // Adaptive volume settings
  // -------------------------

  // Start reducing volume
  const LOUD_START = -15;

  // Stop reducing volume
  const LOUD_END = -20;

  // Final adaptive volume level
  const ADAPTIVE_GAIN = 0.70;

  // -------------------------
  // Setup Web Audio
  // -------------------------

  const setupAudio = async () => {
    if (!audioContextRef.current) {
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      const audioContext = new AudioContext();

      const source =
        audioContext.createMediaElementSource(
          videoRef.current
        );

      const analyser =
        audioContext.createAnalyser();

      analyser.fftSize = 2048;

      const gainNode =
        audioContext.createGain();

      source.connect(analyser);

      analyser.connect(gainNode);

      gainNode.connect(
        audioContext.destination
      );

      gainNode.gain.value =
        volumeRef.current;

      audioContextRef.current =
        audioContext;

      sourceRef.current = source;

      analyserRef.current =
        analyser;

      gainNodeRef.current =
        gainNode;
    }

    if (
      audioContextRef.current.state ===
      "suspended"
    ) {
      await audioContextRef.current.resume();
    }
  };

  // -------------------------
  // Audio analysis
  // -------------------------

  const updateAudio = () => {
    if (!analyserRef.current) {
      return;
    }

    const analyser =
      analyserRef.current;

    const dataArray =
      new Uint8Array(
        analyser.fftSize
      );

    analyser.getByteTimeDomainData(
      dataArray
    );

    // Calculate RMS
    let sum = 0;

    for (
      let i = 0;
      i < dataArray.length;
      i++
    ) {
      const normalized =
        (dataArray[i] - 128) / 128;

      sum +=
        normalized * normalized;
    }

    const rms = Math.sqrt(
      sum / dataArray.length
    );

    // Convert RMS to dB
    let db;

    if (rms === 0) {
      db = -Infinity;
    } else {
      db =
        20 * Math.log10(rms);
    }

    // -------------------------
    // Audio meter
    // -------------------------

    const minDb = -60;
    const maxDb = 0;

    let percentage =
      ((db - minDb) /
        (maxDb - minDb)) *
      100;

    percentage = Math.max(
      0,
      Math.min(100, percentage)
    );

    setAudioLevel(
      percentage
    );

    // -------------------------
    // dB display
    // -------------------------

    if (db === -Infinity) {
      setAudioValue("-∞ dB");
    } else {
      setAudioValue(
        `${db.toFixed(1)} dB`
      );
    }

    // -------------------------
    // Adaptive volume
    // -------------------------

    if (gainNodeRef.current) {
      const gainNode =
        gainNodeRef.current;

      // Start adaptive reduction
      if (
        !loudStateRef.current &&
        db >= LOUD_START
      ) {
        loudStateRef.current =
          true;

        setIsTooLoud(true);
      }

      // Stop adaptive reduction
      if (
        loudStateRef.current &&
        db <= LOUD_END
      ) {
        loudStateRef.current =
          false;

        setIsTooLoud(false);
      }

      // Decide target volume
      const targetGain =
        loudStateRef.current
          ? volumeRef.current *
            ADAPTIVE_GAIN
          : volumeRef.current;

      // Smoothly move toward target
      gainNode.gain.setTargetAtTime(
        targetGain,
        audioContextRef.current.currentTime,
        loudStateRef.current
          ? 0.25
          : 0.5
      );

      // -------------------------
      // Show actual gain
      // -------------------------

      const actualGain =
        gainNode.gain.value;

      const gainPercentage =
        volumeRef.current === 0
          ? 0
          : (actualGain /
              volumeRef.current) *
            100;

      setAdaptiveGain(
        Math.round(
          gainPercentage
        )
      );
    }

    animationRef.current =
      requestAnimationFrame(
        updateAudio
      );
  };

  // -------------------------
  // Play / Pause
  // -------------------------

  const togglePlay = async () => {
    try {
      await setupAudio();

      if (
        videoRef.current.paused
      ) {
        await videoRef.current.play();

        setIsPlaying(true);

        if (
          !animationRef.current
        ) {
          updateAudio();
        }
      } else {
        videoRef.current.pause();

        setIsPlaying(false);

        cancelAnimationFrame(
          animationRef.current
        );

        animationRef.current =
          null;
      }
    } catch (error) {
      console.error(
        "Audio error:",
        error
      );
    }
  };

  // -------------------------
  // Progress
  // -------------------------

  const updateProgress = () => {
    setCurrentTime(
      videoRef.current.currentTime
    );
  };

  const handleLoadedMetadata =
    () => {
      setDuration(
        videoRef.current.duration
      );
    };

  const handleSeek = (e) => {
    const newTime =
      Number(e.target.value);

    videoRef.current.currentTime =
      newTime;

    setCurrentTime(newTime);
  };

  // -------------------------
  // Manual volume
  // -------------------------

  const changeVolume = (e) => {
    const newVolume =
      Number(e.target.value);

    volumeRef.current =
      newVolume;

    setVolume(newVolume);

    if (gainNodeRef.current) {
      const targetGain =
        loudStateRef.current
          ? newVolume *
            ADAPTIVE_GAIN
          : newVolume;

      gainNodeRef.current.gain.setTargetAtTime(
        targetGain,
        audioContextRef.current.currentTime,
        0.1
      );
    }
  };

  // -------------------------
  // Fullscreen
  // -------------------------

  const toggleFullscreen = () => {
    if (
      !document.fullscreenElement
    ) {
      playerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // -------------------------
  // Format time
  // -------------------------

  const formatTime = (time) => {
    if (isNaN(time)) {
      return "00:00";
    }

    const minutes =
      Math.floor(time / 60);

    const seconds =
      Math.floor(time % 60);

    return `${String(
      minutes
    ).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  };

  // -------------------------
  // Controls
  // -------------------------

  const showPlayerControls =
    () => {
      setShowControls(true);

      clearTimeout(
        hideControlsTimer.current
      );

      if (
        !videoRef.current.paused
      ) {
        hideControlsTimer.current =
          setTimeout(() => {
            setShowControls(false);
          }, 3000);
      }
    };

  // -------------------------
  // Effects
  // -------------------------

  useEffect(() => {
    if (isPlaying) {
      showPlayerControls();
    } else {
      setShowControls(true);

      clearTimeout(
        hideControlsTimer.current
      );
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(
        animationRef.current
      );

      clearTimeout(
        hideControlsTimer.current
      );
    };
  }, []);

  // -------------------------
  // UI
  // -------------------------

  return (
    <div className="app">

      <h1>
        Adaptive Volume Player
      </h1>

      <div
        className="player-container"
        ref={playerRef}
        onMouseMove={
          showPlayerControls
        }
        onMouseEnter={
          showPlayerControls
        }
      >

        <video
          ref={videoRef}
          className="video-player"
          src={videoFile}
          onClick={togglePlay}
          onTimeUpdate={
            updateProgress
          }
          onLoadedMetadata={
            handleLoadedMetadata
          }
          onEnded={() => {
            setIsPlaying(false);

            cancelAnimationFrame(
              animationRef.current
            );

            animationRef.current =
              null;
          }}
        />

        <div
          className={`controls ${
            showControls
              ? "controls-visible"
              : "controls-hidden"
          }`}
        >

          <button
            onClick={togglePlay}
          >
            {isPlaying
              ? "❚❚"
              : "▶"}
          </button>

          <span>
            {formatTime(
              currentTime
            )}
          </span>

          <input
            type="range"
            className="progress-bar"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
          />

          <span>
            {formatTime(duration)}
          </span>

          <span>
            🔊
          </span>

          <input
            type="range"
            className="volume-bar"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={changeVolume}
          />

          <button>
            ⚙
          </button>

          <button
            onClick={
              toggleFullscreen
            }
          >
            ⛶
          </button>

        </div>
      </div>

      <div className="adaptive-status">

        <span>
          {isTooLoud
            ? "🔴 Loud Audio Detected"
            : "🟢 Audio Level Normal"}
        </span>

        <div className="audio-meter">
          <div
            className="audio-level"
            style={{
              width: `${audioLevel}%`,
            }}
          />
        </div>

        <span className="audio-value">
          {audioValue}
        </span>

        <span className="adaptive-gain">
          Adaptive:{" "}
          {adaptiveGain}%
        </span>

      </div>

    </div>
  );
}

export default App;