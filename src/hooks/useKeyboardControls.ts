import { useEffect } from "react";
import { useRoundStore } from "../state/roundStore";

type ControlConfig = {
  enabled: boolean;
};

export const useKeyboardControls = ({ enabled }: ControlConfig) => {
  const markCorrect = useRoundStore((state) => state.markCorrect);
  const passQuestion = useRoundStore((state) => state.passQuestion);
  const switchTurn = useRoundStore((state) => state.switchTurn);
  const toggleAnswerVisibility = useRoundStore(
    (state) => state.toggleAnswerVisibility
  );
  const undoLastAction = useRoundStore((state) => state.undoLastAction);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      switch (event.code) {
        case "KeyW":
          event.preventDefault();
          markCorrect();
          break;
        case "KeyD":
          event.preventDefault();
          passQuestion();
          break;
        case "KeyA":
          event.preventDefault();
          switchTurn();
          break;
        case "KeyZ":
          event.preventDefault();
          undoLastAction();
          break;
        case "KeyH":
          event.preventDefault();
          toggleAnswerVisibility();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    markCorrect,
    passQuestion,
    switchTurn,
    toggleAnswerVisibility,
    undoLastAction,
  ]);
};
