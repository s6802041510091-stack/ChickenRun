import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

export function Chicken({ size = 110 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 120 120">
    <Path d="M45 91 L40 110 L26 112 M70 94 L79 108 L93 107" stroke="#b66427" strokeWidth="7" strokeLinecap="round" fill="none" />
    <Path d="M29 66 Q7 51 14 34 Q30 36 40 54" fill="#ffe6a2" stroke="#633b28" strokeWidth="3" />
    <Ellipse cx="57" cy="70" rx="34" ry="32" fill="#fff5d6" stroke="#633b28" strokeWidth="3" />
    <Path d="M39 66 Q18 84 44 88 Q64 84 61 67" fill="#ffdc79" stroke="#633b28" strokeWidth="2.5" />
    <Path d="M66 35 Q53 15 64 12 Q71 10 74 24 Q74 2 84 7 Q90 10 85 25 Q99 9 103 20 Q105 28 89 40" fill="#e9523e" stroke="#633b28" strokeWidth="2.5" />
    <Circle cx="79" cy="47" r="23" fill="#fff5d6" stroke="#633b28" strokeWidth="3" />
    <Path d="M96 48 L114 57 L96 63 Z" fill="#efa33e" stroke="#633b28" strokeWidth="2.5" />
    <Path d="M86 69 Q94 85 101 73 Q102 65 94 62" fill="#e9523e" />
    <Circle cx="84" cy="43" r="5" fill="#352d25" /><Circle cx="85" cy="41" r="1.5" fill="white" />
    <Path d="M74 33 L87 30" stroke="#633b28" strokeWidth="3" strokeLinecap="round" />
    <Ellipse cx="75" cy="56" rx="6" ry="4" fill="#f4b3a0" />
    <Path d="M58 65 Q73 69 84 65 L78 75 L62 73 Z" fill="#4c8670" />
  </Svg>;
}
export function Colonel({ size = 84 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 100 120">
    <Path d="M30 97 L22 116 M66 97 L79 113" stroke="#3e4847" strokeWidth="10" strokeLinecap="round" />
    <Path d="M26 56 Q48 45 70 59 L81 100 L20 100 Z" fill="#fffaf0" stroke="#4d4640" strokeWidth="3" />
    <Path d="M28 63 L9 78 M72 63 L90 53" stroke="#fffaf0" strokeWidth="12" strokeLinecap="round" />
    <Circle cx="50" cy="33" r="24" fill="#f1c495" />
    <Path d="M25 32 Q15 0 49 6 Q85 -2 76 31 L65 18 Q46 29 31 20 Z" fill="#fffaf0" />
    <Path d="M31 43 Q50 65 70 42 Q66 65 51 68 Q35 62 31 43" fill="#fffaf0" />
    <Rect x="29" y="29" width="18" height="12" rx="4" fill="none" stroke="#383d38" strokeWidth="3" />
    <Rect x="53" y="29" width="18" height="12" rx="4" fill="none" stroke="#383d38" strokeWidth="3" />
    <Path d="M47 33 L53 33 M43 50 L58 50 M38 70 L61 80 L61 70 L38 80 Z" stroke="#383d38" strokeWidth="3" />
    <SvgText x="50" y="94" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#c84d38">KFC</SvgText>
  </Svg>;
}
export function Scenery({ kind, accent }: { kind: string; accent: string }) {
  return <G>
    {kind === 'shop' && <G><Rect x="8" y="46" width="130" height="102" rx="5" fill="#fff6dc" /><Rect x="13" y="64" width="120" height="35" rx="2" fill={accent} /><SvgText x="73" y="87" textAnchor="middle" fill="#fff8e7" fontSize="15" fontWeight="bold">CHICKEN</SvgText><Path d="M4 99 L143 99 L135 111 L12 111 Z" fill="#efaa83" /><Rect x="23" y="116" width="36" height="32" fill="#66918a" /><Rect x="77" y="112" width="34" height="36" fill="#7d5e49" /><Circle cx="74" cy="44" r="24" fill="#f6c44f" /><Path d="M68 52 L69 35 L83 43 Z" fill={accent} /></G>}
    {kind === 'alley' && <G><Rect x="0" y="40" width="108" height="112" fill="#ba886b" /><Path d="M0 70 H108 M0 100 H108 M25 40 V70 M75 70 V100" stroke="#9b6a51" strokeWidth="3" /><Rect x="45" y="111" width="42" height="38" rx="4" fill="#527568" /><Rect x="40" y="107" width="51" height="8" fill="#355d4f" /><Rect x="294" y="98" width="50" height="50" fill="#caa068" /></G>}
    {kind === 'factory' && <G><Rect x="13" y="62" width="114" height="89" fill="#7f9790" /><Path d="M13 62 V42 L51 62 V42 L90 62 V42 L127 62" fill="#a3b7ab" /><Rect x="38" y="7" width="19" height="49" fill="#657970" /><Rect x="83" y="15" width="16" height="39" fill="#657970" />{[24, 59, 94].map(x => <Rect key={x} x={x} y="80" width="20" height="29" fill="#dce6bd" />)}<Rect x="286" y="71" width="55" height="80" rx="12" fill="#b7c3ba" /></G>}
    {kind === 'farm' && <G><Path d="M11 101 L64 49 L116 101 V151 H11 Z" fill={accent} /><Path d="M3 101 L64 43 L124 101" fill="none" stroke="#fff0d1" strokeWidth="8" /><Rect x="43" y="109" width="41" height="42" fill="#734b36" /><Path d="M43 109 L84 151 M84 109 L43 151" stroke="#f9dba7" strokeWidth="3" /><Path d="M260 140 H360 M270 117 V160 M303 117 V160 M338 117 V160" stroke="#fff0d1" strokeWidth="7" /></G>}
    {kind === 'road' && <G><Path d="M39 151 V55 Q39 32 67 32" stroke="#6e8074" strokeWidth="6" fill="none" /><Rect x="55" y="29" width="30" height="8" rx="3" fill="#5f7065" /><Rect x="281" y="73" width="66" height="37" rx="5" fill="#477a66" /><Path d="M302 111 V156" stroke="#e8e4c9" strokeWidth="6" /><SvgText x="314" y="97" textAnchor="middle" fill="#fff6d8" fontSize="15">↑ FREE</SvgText></G>}
    {kind === 'mountain' && <G><Path d="M-30 153 L65 14 L159 153 M238 153 L310 26 L397 153" fill="#85969e" /><Path d="M41 49 L65 14 L90 50 L69 40 L58 52 Z M290 61 L310 26 L331 62 L311 52 Z" fill="#fff8e8" /></G>}
    <Path d="M168 150 Q190 99 211 151" fill="#76966c" opacity=".55" />
  </G>;
}
