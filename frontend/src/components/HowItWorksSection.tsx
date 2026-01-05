import { useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";

const howItWorksSteps = [
  {
    number: 1,
    title: 'Point to Your Project',
    description: 'Enter the path to your project directory. We support JavaScript, TypeScript, and Python.',
    gradientFrom: '#FF9A9D',
    gradientTo: '#FF9A9D',
    image: '/upload-cr.png'
  },
  {
    number: 2,
    title: 'AI Analysis',
    description: "Our AI processes your files, extracting imports and understanding each file's purpose.",
    gradientFrom: '#8FBCFA',
    gradientTo: '#8FBCFA',
    image: '/grid-mountains-1.png'
  },
  {
    number: 3,
    title: 'Explore the Graph',
    description: 'Navigate your codebase visually, understanding dependencies and architecture at a glance.',
    gradientFrom: '#F6D785',
    gradientTo: '#F6D785',
    image: '/visualize-cr.png'
  },
];

export default function HowItWorksSection() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Rotate steps every 6 seconds (unless paused)
  useEffect(() => {
    if (isCarouselPaused) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % howItWorksSteps.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isCarouselPaused]);

  return (
    <section id="how-it-works" className="py-4 md:py-20 px-4 h-[100vh] min-h-[1000px] flex flex-col justify-center bg-white gap-6">
      <motion.div
        className="text-center mb-20"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, amount: 0.8 }}
      >
        <span className="text-[#8FBCFA] font-semibold text-sm uppercase tracking-wider">How It Works</span>
        <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
          Three simple steps
        </h2>
      </motion.div>

      {/* Animated Step Carousel */}
      <div className="relative lg:h-[60vh] h-[80vh] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute text-center max-w-lg mx-auto"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold"
              style={{
                background: `linear-gradient(to bottom right, ${howItWorksSteps[currentStep].gradientFrom}33, ${howItWorksSteps[currentStep].gradientTo}1a)`,
                color: howItWorksSteps[currentStep].gradientFrom,
              }}
            >
              {howItWorksSteps[currentStep].number}
            </div>
            <h3 className="text-3xl font-semibold text-gray-900 mb-3">
              {howItWorksSteps[currentStep].title}
            </h3>
            <p className="text-gray-600 text-xl">
              {howItWorksSteps[currentStep].description}
            </p>
            <img src={howItWorksSteps[currentStep].image} alt={howItWorksSteps[currentStep].title} className="mt-6 rounded-lg shadow-md mx-auto max-h-[70%] object-cover" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Step Indicators */}
      <div className="flex flex-col justify-center items-center gap-4 mt-16">
        <div className='flex flex-row justify-center items-center gap-3'>
          {howItWorksSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentStep
                  ? 'bg-gray-900 scale-110'
                  : 'bg-gray-300 hover:bg-gray-400'
                }`}
              aria-label={`Go to step ${index + 1}`}
            />

          ))}
        </div>
        <button
          onClick={() => setIsCarouselPaused(!isCarouselPaused)}
          className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition-all duration-200"
          aria-label={isCarouselPaused ? 'Resume carousel' : 'Pause carousel'}
        >
          {isCarouselPaused ? (
            <Play size={14} className="text-gray-600 ml-0.5" />
          ) : (
            <Pause size={14} className="text-gray-600 " />
          )}
        </button>
      </div>

    </section>
  );
}
