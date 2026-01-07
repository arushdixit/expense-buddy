import React, { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";

interface FloatingActionButtonProps {
  onClick: () => void;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;

      // Only trigger on significant scroll (prevents jitter)
      if (Math.abs(scrollDelta) < 5) return;

      // Show FAB when scrolling up or at the top
      if (scrollDelta < 0 || currentScrollY < 50) {
        setIsVisible(true);
      }
      // Hide FAB when scrolling down
      else if (scrollDelta > 0 && currentScrollY > 50) {
        setIsVisible(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.button
      onClick={onClick}
      className="fab"
      initial={{ y: 0, opacity: 1 }}
      animate={{
        y: isVisible ? 0 : 160, // Increased distance to exit screen fully
        opacity: isVisible ? 1 : 0,
        scale: isVisible ? 1 : 0.8 // Slightly more pronounced scale
      }}
      transition={{
        duration: 0.12, // Faster 120ms transition
        // Material Design "Standard" Easing (Fast start, smooth end)
        ease: [0.4, 0, 0.2, 1]
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Plus className="h-7 w-7" />
    </motion.button>
  );
};
