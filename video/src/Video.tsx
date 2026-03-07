import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Easing,
} from "remotion";

// -- Color palette --
const COLORS = {
  bg: "#0f0f13",
  bgAlt: "#16161d",
  accent: "#6c5ce7",
  accentLight: "#a29bfe",
  text: "#e8e8ed",
  textDim: "#8b8b9e",
  gold: "#f0c040",
  green: "#00cec9",
  orange: "#e17055",
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
};

// -- Shared styles --
const fullCenter: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily:
    '"SF Pro Display", "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif',
  backgroundColor: COLORS.bg,
  color: COLORS.text,
  overflow: "hidden",
};

// -- Utility: fade + slide up entrance --
function useFadeSlideUp(
  frame: number,
  fps: number,
  delay: number,
  slideDistance = 60
) {
  const opacity = spring({ frame: frame - delay, fps, config: { damping: 20 } });
  const translateY = interpolate(opacity, [0, 1], [slideDistance, 0]);
  return { opacity, transform: `translateY(${translateY}px)` };
}

// =============================================
// Scene 1: Title (0 - 5s = frames 0-149)
// =============================================
const SceneTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background grid pattern
  const gridOpacity = interpolate(frame, [0, 60], [0, 0.15], {
    extrapolateRight: "clamp",
  });

  // Main title
  const titleSpring = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const titleScale = interpolate(titleSpring, [0, 1], [0.6, 1]);
  const titleOpacity = titleSpring;

  // Subtitle
  const subStyle = useFadeSlideUp(frame, fps, 35);

  // Decorative line
  const lineWidth = interpolate(frame, [25, 55], [0, 400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Glow pulse
  const glowIntensity = interpolate(
    Math.sin(frame * 0.05),
    [-1, 1],
    [20, 50]
  );

  return (
    <AbsoluteFill style={fullCenter}>
      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: gridOpacity,
          backgroundImage: `
            linear-gradient(rgba(108,92,231,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(108,92,231,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow behind title */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(108,92,231,0.2) 0%, transparent 70%)`,
          filter: `blur(${glowIntensity}px)`,
        }}
      />

      {/* Chinese title */}
      <div
        style={{
          fontSize: 140,
          fontWeight: 800,
          letterSpacing: 30,
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          textShadow: `0 0 40px rgba(108,92,231,0.5)`,
        }}
      >
        丞相
      </div>

      {/* Decorative line */}
      <div
        style={{
          width: lineWidth,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.accent}, transparent)`,
          margin: "20px 0",
        }}
      />

      {/* English title */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 300,
          letterSpacing: 16,
          color: COLORS.textDim,
          ...subStyle,
        }}
      >
        MINISTER
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 28,
          fontWeight: 400,
          color: COLORS.accentLight,
          marginTop: 40,
          ...useFadeSlideUp(frame, fps, 55),
        }}
      >
        把 Claude Code 塞进飞书，给你的团队加一个全能同事
      </div>
    </AbsoluteFill>
  );
};

// =============================================
// Scene 2: What is it (5 - 13s = frames 150-389)
// =============================================
const SceneWhatIsIt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lines = [
    "一个基于 Claude Code 的飞书 AI 助手框架",
    "不是聊天机器人 —— 是住在飞书里的同事",
    "你说一句，它就把事情办了",
  ];

  return (
    <AbsoluteFill style={{ ...fullCenter, padding: "0 160px" }}>
      {/* Section badge */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 6,
          color: COLORS.accent,
          textTransform: "uppercase",
          marginBottom: 50,
          ...useFadeSlideUp(frame, fps, 5),
        }}
      >
        What is Minister?
      </div>

      {lines.map((line, i) => {
        const delay = 20 + i * 30;
        const style = useFadeSlideUp(frame, fps, delay, 40);
        return (
          <div
            key={i}
            style={{
              fontSize: i === 0 ? 52 : 44,
              fontWeight: i === 0 ? 700 : 400,
              color: i === 0 ? COLORS.text : COLORS.textDim,
              textAlign: "center",
              lineHeight: 1.5,
              marginBottom: 24,
              ...style,
            }}
          >
            {line}
          </div>
        );
      })}

      {/* Accent underline */}
      <div
        style={{
          width: interpolate(frame, [80, 120], [0, 200], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 3,
          borderRadius: 2,
          background: COLORS.accent,
          marginTop: 30,
        }}
      />
    </AbsoluteFill>
  );
};

// =============================================
// Scene 3: Core Features (13 - 25s = frames 390-749)
// =============================================
interface FeatureCardProps {
  icon: string;
  title: string;
  desc: string;
  delay: number;
  color: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  desc,
  delay,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useFadeSlideUp(frame, fps, delay, 50);

  return (
    <div
      style={{
        width: 480,
        padding: "40px 36px",
        background: COLORS.cardBg,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 16,
        ...style,
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 20, color: COLORS.textDim, lineHeight: 1.6 }}>
        {desc}
      </div>
    </div>
  );
};

const SceneFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const features: Omit<FeatureCardProps, "delay">[] = [
    {
      icon: "\u2699\ufe0f",
      title: "MCP \u534f\u8bae\u9a71\u52a8",
      desc: "\u901a\u8fc7 MCP \u5c06\u98de\u4e66 API \u66b4\u9732\u7ed9 Claude\uff0c\u62e5\u6709\u771f\u6b63\u7684\u6267\u884c\u529b",
      color: COLORS.accent,
    },
    {
      icon: "\ud83e\udde0",
      title: "\u7528\u6237\u8bb0\u5fc6\u9694\u79bb",
      desc: "\u6bcf\u4eba\u72ec\u7acb CLAUDE.md\uff0c\u504f\u597d\u4e92\u4e0d\u5e72\u6270\uff0c\u91cd\u542f\u4e0d\u4e22",
      color: COLORS.green,
    },
    {
      icon: "\ud83d\udcac",
      title: "\u6d41\u5f0f\u5361\u7247\u54cd\u5e94",
      desc: "WebSocket \u957f\u8fde\u63a5 + \u4ea4\u4e92\u5f0f\u5361\u7247\uff0c\u5b9e\u65f6\u5c55\u793a\u5904\u7406\u8fdb\u5ea6",
      color: COLORS.gold,
    },
    {
      icon: "\ud83d\uddbc\ufe0f",
      title: "\u56fe\u7247\u7406\u89e3",
      desc: "\u539f\u751f\u652f\u6301\u56fe\u7247\u8f93\u5165\uff0c\u8bc6\u56fe\u3001\u770b\u622a\u56fe\u3001\u5206\u6790\u8bbe\u8ba1\u7a3f",
      color: COLORS.orange,
    },
  ];

  return (
    <AbsoluteFill style={fullCenter}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 6,
          color: COLORS.accent,
          marginBottom: 20,
          ...useFadeSlideUp(frame, fps, 5),
        }}
      >
        CORE FEATURES
      </div>
      <div
        style={{
          fontSize: 52,
          fontWeight: 700,
          marginBottom: 60,
          ...useFadeSlideUp(frame, fps, 15),
        }}
      >
        核心能力
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 28,
          justifyContent: "center",
          maxWidth: 1100,
        }}
      >
        {features.map((f, i) => (
          <FeatureCard key={i} {...f} delay={30 + i * 25} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// =============================================
// Scene 4: Tool Categories (25 - 35s = frames 750-1049)
// =============================================
const SceneTools: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tools = [
    { cat: "\u6d88\u606f", items: "msg_send / msg_reply / msg_read_history", color: COLORS.accent },
    { cat: "\u4efb\u52a1", items: "task_create / update / complete / query", color: COLORS.green },
    { cat: "\u6587\u6863", items: "doc_create / doc_read / doc_update", color: COLORS.gold },
    { cat: "\u65e5\u5386", items: "cal_create_event / query / freebusy", color: COLORS.orange },
    { cat: "\u591a\u7ef4\u8868\u683c", items: "bitable_create / query / update", color: COLORS.accentLight },
    { cat: "\u901a\u8baf\u5f55", items: "contact_search / contact_get_user", color: "#fd79a8" },
  ];

  return (
    <AbsoluteFill style={{ ...fullCenter, padding: "0 120px" }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 6,
          color: COLORS.accent,
          marginBottom: 20,
          ...useFadeSlideUp(frame, fps, 5),
        }}
      >
        MCP TOOLS
      </div>
      <div
        style={{
          fontSize: 52,
          fontWeight: 700,
          marginBottom: 60,
          ...useFadeSlideUp(frame, fps, 15),
        }}
      >
        6 大类 20 个飞书原生工具
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 24,
          width: "100%",
          maxWidth: 1400,
        }}
      >
        {tools.map((t, i) => {
          const style = useFadeSlideUp(frame, fps, 25 + i * 18, 30);
          return (
            <div
              key={i}
              style={{
                padding: "30px 32px",
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: 14,
                borderLeft: `4px solid ${t.color}`,
                ...style,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: t.color,
                  marginBottom: 10,
                }}
              >
                {t.cat}
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: COLORS.textDim,
                  fontFamily: '"Cascadia Code", "Fira Code", monospace',
                }}
              >
                {t.items}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// =============================================
// Scene 5: Architecture (35 - 42s = frames 1050-1259)
// =============================================
const SceneArchitecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const boxes = [
    { label: "bot-server", sub: "\u98de\u4e66\u673a\u5668\u4eba\u670d\u52a1\nWebSocket \u957f\u8fde\u63a5", color: COLORS.accent },
    { label: "feishu-mcp", sub: "MCP \u5de5\u5177\u670d\u52a1\n\u5411 Claude \u66b4\u9732\u98de\u4e66 API", color: COLORS.green },
    { label: "shared", sub: "\u5171\u4eab\u7c7b\u578b\u4e0e\u914d\u7f6e", color: COLORS.gold },
  ];

  // Arrow animation
  const arrowProgress = interpolate(frame, [60, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={fullCenter}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 6,
          color: COLORS.accent,
          marginBottom: 20,
          ...useFadeSlideUp(frame, fps, 5),
        }}
      >
        ARCHITECTURE
      </div>
      <div
        style={{
          fontSize: 52,
          fontWeight: 700,
          marginBottom: 70,
          ...useFadeSlideUp(frame, fps, 15),
        }}
      >
        TypeScript Monorepo
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 50,
        }}
      >
        {/* Feishu cloud */}
        <div
          style={{
            ...useFadeSlideUp(frame, fps, 25, 30),
            padding: "30px 40px",
            background: "rgba(108,92,231,0.12)",
            border: `2px solid ${COLORS.accent}`,
            borderRadius: 20,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 700 }}>Feishu</div>
          <div style={{ fontSize: 18, color: COLORS.textDim, marginTop: 8 }}>
            WebSocket
          </div>
        </div>

        {/* Arrow */}
        <div
          style={{
            fontSize: 36,
            color: COLORS.accent,
            opacity: arrowProgress,
          }}
        >
          {">>>"}
        </div>

        {/* Architecture boxes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {boxes.map((b, i) => (
            <div
              key={i}
              style={{
                padding: "24px 40px",
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.cardBorder}`,
                borderLeft: `4px solid ${b.color}`,
                borderRadius: 14,
                minWidth: 360,
                ...useFadeSlideUp(frame, fps, 35 + i * 20, 30),
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: b.color,
                  fontFamily: '"Cascadia Code", "Fira Code", monospace',
                }}
              >
                {b.label}
              </div>
              <div
                style={{
                  fontSize: 17,
                  color: COLORS.textDim,
                  marginTop: 6,
                  whiteSpace: "pre-line",
                }}
              >
                {b.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Arrow */}
        <div
          style={{
            fontSize: 36,
            color: COLORS.green,
            opacity: arrowProgress,
          }}
        >
          {">>>"}
        </div>

        {/* Claude */}
        <div
          style={{
            ...useFadeSlideUp(frame, fps, 80, 30),
            padding: "30px 40px",
            background: "rgba(0,206,201,0.12)",
            border: `2px solid ${COLORS.green}`,
            borderRadius: 20,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 700 }}>Claude</div>
          <div style={{ fontSize: 18, color: COLORS.textDim, marginTop: 8 }}>
            Code CLI
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================
// Scene 6: Tech Stack + Closing (42 - 50s = frames 1260-1499)
// =============================================
const SceneClosing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stack = [
    { name: "Bun", role: "Runtime" },
    { name: "TypeScript", role: "Language" },
    { name: "@larksuiteoapi/node-sdk", role: "Feishu SDK" },
    { name: "@modelcontextprotocol/sdk", role: "MCP SDK" },
    { name: "Zod", role: "Validation" },
  ];

  // CTA pulse
  const pulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.95, 1.05]);

  return (
    <AbsoluteFill style={fullCenter}>
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(108,92,231,0.15) 0%, transparent 60%)",
          filter: "blur(40px)",
        }}
      />

      {/* Tech stack row */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginBottom: 80,
          ...useFadeSlideUp(frame, fps, 5),
        }}
      >
        {stack.map((s, i) => (
          <div
            key={i}
            style={{
              padding: "16px 28px",
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 10,
              textAlign: "center",
              ...useFadeSlideUp(frame, fps, 10 + i * 12),
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.accentLight,
              }}
            >
              {s.name}
            </div>
            <div style={{ fontSize: 14, color: COLORS.textDim, marginTop: 4 }}>
              {s.role}
            </div>
          </div>
        ))}
      </div>

      {/* Big title */}
      <div
        style={{
          fontSize: 90,
          fontWeight: 800,
          letterSpacing: 20,
          ...useFadeSlideUp(frame, fps, 60),
          textShadow: "0 0 60px rgba(108,92,231,0.4)",
        }}
      >
        丞相
      </div>

      <div
        style={{
          fontSize: 28,
          color: COLORS.textDim,
          marginTop: 30,
          ...useFadeSlideUp(frame, fps, 75),
        }}
      >
        Docker 一键部署 -- Apache 2.0 开源协议
      </div>

      {/* CTA */}
      <div
        style={{
          marginTop: 50,
          padding: "18px 60px",
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentLight})`,
          borderRadius: 50,
          fontSize: 28,
          fontWeight: 700,
          transform: `scale(${pulse})`,
          ...useFadeSlideUp(frame, fps, 90),
        }}
      >
        github.com/anthropics/minister
      </div>
    </AbsoluteFill>
  );
};

// =============================================
// Scene transition: crossfade
// =============================================
const SceneWithTransition: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
}> = ({ children, durationInFrames }) => {
  const frame = useCurrentFrame();

  // Fade in first 15 frames, fade out last 15 frames
  const opacity = interpolate(
    frame,
    [0, 15, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};

// =============================================
// Scene audio files
// =============================================
const VOICEOVERS = [
  "audio/scene1-title.mp3",
  "audio/scene2-what.mp3",
  "audio/scene3-features.mp3",
  "audio/scene4-tools.mp3",
  "audio/scene5-arch.mp3",
  "audio/scene6-closing.mp3",
];

// =============================================
// Main composition (total: 1725 frames = 57.5s)
// =============================================
export const MinisterIntro: React.FC = () => {
  const scenes: { component: React.FC; duration: number }[] = [
    { component: SceneTitle, duration: 165 },          // 0-5.5s
    { component: SceneWhatIsIt, duration: 330 },       // 5.5-16.5s
    { component: SceneFeatures, duration: 405 },       // 16.5-30s
    { component: SceneTools, duration: 315 },          // 30-40.5s
    { component: SceneArchitecture, duration: 270 },   // 40.5-49.5s
    { component: SceneClosing, duration: 240 },        // 49.5-57.5s = 1725 frames
  ];

  let offset = 0;
  const sequenceData = scenes.map(({ component, duration }, i) => {
    const from = offset;
    offset += duration;
    return { component, duration, from, voiceover: VOICEOVERS[i] };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Background music - full duration, low volume */}
      <Audio src={staticFile("audio/bgm.wav")} volume={0.3} />

      {sequenceData.map(({ component: Comp, duration, from, voiceover }, i) => (
        <Sequence key={i} from={from} durationInFrames={duration}>
          <SceneWithTransition durationInFrames={duration}>
            <Comp />
          </SceneWithTransition>
          {/* Voiceover for this scene, delayed slightly for transition */}
          <Audio src={staticFile(voiceover)} volume={0.9} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
