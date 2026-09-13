"use client"

import { motion } from "framer-motion"
import Image from "next/image"

interface ChristmasLogoProps {
  isGenius?: boolean
  showIcon?: boolean
  className?: string
}

export function ChristmasLogo({ isGenius = false, showIcon = true, className = "" }: ChristmasLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && (
        <motion.div
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6 }}
          className="flex h-10 w-10 items-center justify-center rounded-xl "
        >
          <Image src="/icon.png" alt="QuillGlow Logo" width={40} height={40} />
        </motion.div>
      )}
      <span className="relative text-xl font-bold text-primary">
        QuillGlow
        {/* Gold "26" with 3D effect and shining sparkle */}
        <svg
          viewBox="0 0 50 32"
          className="absolute -top-3 -right-6 w-11 h-8 drop-shadow"
          style={{ transform: "rotate(10deg)" }}
        >
          {/* Main "2" with gold gradient and shadow */}
          
          {/* "2" */}
          {/*  */}
          <ellipse
            cx="25"
            cy="10"
            rx="15"
            ry="4"
            fill="url(#shine)"
            opacity="0.9"
          />
          {/* Sparkle/shining star */}
          <g>
            <g transform="translate(39 8) rotate(-5)">
              <polygon points="0,-1.8 0.7,-0.5 2,0 0.7,0.5 0,1.8 -0.7,0.5 -2,0 -0.7,-0.5"
                fill="#fffbe2"
                opacity="0.9"
              />
              <polygon points="0,-1.2 0.5,-0.35 1.3,0 0.5,0.35 0,1.2 -0.5,0.35 -1.3,0 -0.5,-0.35"
                fill="#fffde7"
                opacity="0.65"
              />
            </g>
            {/* Extra subtle sparkles */}
            <circle cx="13" cy="6" r="0.9" fill="#fffbe9" opacity="0.85" />
            <rect x="30" y="5.3" width="1" height="2.2" rx="0.5" fill="#fffde9" opacity="0.33" />
          </g>
        </svg>
        {isGenius && (
          <sup
            className="align-super text-base text-yellow-500 tracking-tight"
            style={{ fontSize: "0.85em", marginLeft: "2px" }}
          >
            <span style={{ fontFamily: "monospace" }}>Genius</span>
          </sup>
        )}
      </span>
    </div>
  )
}

export function ChristmasLogoText({ isGenius = false }: { isGenius?: boolean }) {
  return (
    <span className="relative text-2xl font-bold text-primary">
      QuillGlow
      
      {isGenius && (
        <sup
          className="align-super text-base text-yellow-500 tracking-tight"
          style={{ fontSize: "0.85em", marginLeft: "2px" }}
        >
          <span style={{ fontFamily: "monospace" }}>Genius</span>
        </sup>
      )}
    </span>
  )
}
