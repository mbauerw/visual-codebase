import { GitBranch, Zap, Eye } from 'lucide-react';
import { motion } from "motion/react";
import { BlueVideoBackground } from './backgrounds';

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-40 min-h-[130vh] flex flex-col justify-center px-4 relative overflow-hidden">
      {/* <img className="absolute top-0 left-0 w-full h-full opacity-[0.6] z-0  scale-108 pointer-events-none" src="/hills-grey.jpeg" /> */}
      {/* Dome-shaped fade overlay - fades top corners, reveals image in dome shape */}
      <BlueVideoBackground />
      <div
        className="absolute top-0 left-0 w-full h-[100%] z-[1] pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 100% at 50% 95%, transparent 20%, transparent 50%, rgba(255, 255, 255, 0.1) 60%, rgba(255, 255, 255, 0.3) 65%, rgba(255, 255, 255, 0.5) 75%, rgba(255, 255, 255, 0.75) 80%, rgba(255, 255, 255, 0.8) 85%, rgba(255, 255, 255, 1) 100%)
          `
        }}
      />
      <div className="max-w-7xl mx-auto z-10 relative">
        <div className="text-center mb-28">
          <span className="text-red-500 font-semibold text-lg uppercase tracking-wider">Features</span>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: false, amount: 0.3 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
              Everything you need to understand your code
            </h2>
            <p className="text-gray-800 text-lg max-w-2xl mx-auto">
              Powerful tools to analyze, visualize, and comprehend complex codebases
            </p>
          </motion.div>
        </div>
        <div className="grid p-12 md:p-0 md:grid-cols-[2fr_2fr] gap-y-12 lg:gap-x-12 lg:gap-y-12 ">
          {/* Feature 1 */}
          <div className="bg-white h-[420px] rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
            <img src='/blueprint.jpeg' alt='ai' className='absolute top-0 left-0 w-full h-full blur-[2px] ' />
            <div className='w-full h-full p-8 z-20 flex flex-col justify-start gap-4 lg:gap-12'>

              <h3 className="text-3xl sm:text-4xl font-semibold text-white z-20">AI-powered Analysis</h3>
              
              <div className='z-20 h-full overflow-hidden'>
                {/* Pusher element - pushes the floated image to bottom half */}
                <div className='float-right h-[50%] sm:h-[30%] w-0' />
                <img
                  src="/analysis-api.png"
                  alt="analysis api"
                  className='float-right clear-right max-h-[50%] lg:max-h-[80%] w-auto ml-4 rounded-lg object-contain'
                />
                <p className="text-gray-100 text-lg md:text-xl pr-8 leading-relaxed ">
                  Automatically generate a full analysis suite for your codebases.
                  Uncover tech stacks and key modules without having to parse through thousands of lines of code. 
                </p>
              </div>

            </div>
          </div>

          {/* Feature 2 */}
          <div className="bg-neutral-100  h-[420px] rounded-3xl p-8 space-y-4 shadow-sm border-4 border-gray-300 hover:shadow-xl  transition-all duration-300 relative overflow-hidden">
            {/* <img src='/visualization.png' alt='vis' className='absolute top-0 left-0 ml-5 mt-10 w-full h-full object-contain opacity-70 z-0' /> */}

            <h3 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 mb-3 relative z-20">Interactive Visualization</h3>
            <div className='relative z-20 h-full overflow-hidden'>
                {/* Pusher element - pushes the floated image to bottom half */}
                <div className='float-left sm:h-[20%] w-0' />
                <img
                  src="/visualization.png"
                  alt="analysis api"
                  className='float-left clear-left max-h-[35%] md:max-h-[45%] mr-8 w-auto rounded-lg object-contain opacity-90'
                />
            <p className="text-gray-600 text-lg lg:text-xl leading-relaxed z-20">
              Build a more complete mental model by exploring your codebase through a visual medium. Visualize function calls and dependency relationships
              through an interactive graph. Understand archetecture at a glance.
            </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="bg-neutral-100 h-[420px] rounded-3xl p-4 space-y-4 shadow-sm border-4 border-gray-300 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
          <img src='/assistant.png' alt='AI Assistant' className='absolute top-[150px] right-0 h-[65%] rounded-lg !opacity-60' />

            <h3 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 mb-3 relative z-20">On-demand AI Assistance</h3>
            <div className='relative z-20 h-full overflow-hidden'>
              {/* Pusher element - pushes the floated image to bottom half */}
              <div className='float-right sm:h-[20%] w-0' />
              <img
                src="/assistant.png"
                alt="AI chatbot"
                className='float-right clear-right max-h-[35%] md:max-h-[45%] w-auto rounded-lg object-contain opacity-0'
              />
              <p className="text-gray-600 text-lg lg:text-xl leading-relaxed z-20">
                Our in-app AI assistant leverages the pre-existing codebase analysis as additional context to provide valuable answers whenever you have a question about the code.
                In addition, by highlighting text from the analysis suite you can automatically provide specific context for any question you might have.
              </p>
            </div>
          </div>

          {/* Feature 1 */}
          {/* <div className="w-3/4 bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8FBCFA] to-[#6BA3F5] flex items-center justify-center mb-6">
              <GitBranch size={28} className="text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Dependency Mapping</h3>
            <p className="text-gray-600 leading-relaxed">
              Automatically extract and visualize import statements across JavaScript, TypeScript, and Python files.
            </p>
          </div> */}
        </div>
      </div>
    </section>
  );
}
