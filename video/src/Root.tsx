import React from "react";
import { Composition } from "remotion";
import { MinisterIntro } from "./Video";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MinisterIntro"
      component={MinisterIntro}
      durationInFrames={1725}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
