import { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { motion, AnimatePresence, useInView } from "motion/react";

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
  const [showAllCards, setShowAllCards] = useState(false);
  const [iterationComplete, setIterationComplete] = useState(false);
  const [animationStarted, setAnimationStarted] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.5, once: true });

  // Start animation when section is 50% in view
  useEffect(() => {
    if (isInView && !animationStarted) {
      setAnimationStarted(true);
    }
  }, [isInView, animationStarted]);

  // Phase 1: Rotate steps every 6 seconds until one full iteration
  useEffect(() => {
    if (!animationStarted || iterationComplete) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        const nextStep = prev + 1;
        if (nextStep >= howItWorksSteps.length) {
          // First iteration complete, trigger phase 2
          setIterationComplete(true);
          return prev;
        }
        return nextStep;
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [animationStarted, iterationComplete]);

  // Phase 2: After iteration complete, show all cards
  useEffect(() => {
    if (iterationComplete && !showAllCards) {
      // Small delay before showing all cards for smooth transition
      const timeout = setTimeout(() => {
        setShowAllCards(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [iterationComplete, showAllCards]);

  return (
    <section ref={sectionRef} id="how-it-works" className="py-12 md:py-20 px-4 min-h-[800px] md:h-[90vh] flex flex-col justify-center bg-white gap-6">
      <motion.div
        className="text-center mb-8 md:mb-20"
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

      {/* Animated Step Carousel / Final Layout */}
      <div className="relative min-h-[500px] md:h-[60vh] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!showAllCards ? (
            // Phase 1: Single card carousel
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
          ) : (
            // Phase 2: All three cards side by side
            <motion.div
              key="all-cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="w-full mx-auto flex flex-col md:flex-row items-center md:items-start justify-center mb-14 gap-6 md:gap-12 px-4"
            >
              {howItWorksSteps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.15,
                    ease: 'easeOut'
                  }}
                  className="w-full md:flex-1 text-center text-wrap max-w-md mx-auto"
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold"
                    style={{
                      background: `linear-gradient(to bottom right, ${step.gradientFrom}33, ${step.gradientTo}1a)`,
                      color: step.gradientFrom,
                    }}
                  >
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 text-lg">
                    {step.description}
                  </p>
                  <img
                    src={step.image}
                    alt={step.title}
                    className="mt-4 rounded-lg shadow-md mx-auto max-h-[180px] md:max-h-[280px] object-cover"
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Step Indicators */}
      {/* <div className="flex flex-col justify-center items-center gap-4 mt-16">
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
      </div> */}

    </section>
  );
}
