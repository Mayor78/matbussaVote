import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle, MousePointer, Eye, Vote, Lock } from 'lucide-react';
import Button from './Button';

const STEPS = [
  {
    icon: MousePointer,
    title: 'How to Vote',
    text: 'You will see a list of positions (like President, Vice President, etc.). For each position, you will choose one candidate. Swipe left or right to see all the candidates.',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    icon: Eye,
    title: 'View Candidate Details',
    text: 'Click on any candidate card to read about them — their name, level, and what they promise to do if elected (manifesto). Take your time to read before you choose.',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    icon: Vote,
    title: 'Cast Your Vote',
    text: 'After clicking a candidate, a box will appear asking you to confirm your choice. Once you confirm, your vote is final — you cannot change it. Make sure you choose correctly!',
    color: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    icon: Lock,
    title: 'One Vote Per Position',
    text: 'You can only vote once for each position. After you vote for all positions, click the "Finish Voting" button. Your vote is secret and no one can see who you voted for.',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    icon: CheckCircle,
    title: 'You Are Done!',
    text: 'After you finish voting, you will see a confirmation page. When the election closes, results will appear on your dashboard so you can see who won each position.',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
];

export default function VotingGuide({ isOpen, onClose }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
          <X className="w-5 h-5" />
        </button>

        <div className={`p-6 ${current.color} border-b`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2.5 rounded-xl ${current.color.replace('50', '100').replace('700', '800').replace('200', '300').replace('text-', 'bg-')}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold opacity-60 uppercase tracking-wider">Step {step + 1} of {STEPS.length}</p>
              <h2 className="text-lg font-extrabold">{current.title}</h2>
            </div>
          </div>
          <p className="text-sm leading-relaxed">{current.text}</p>
        </div>

        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-primary-600 w-5' : 'bg-gray-300'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {isLast ? (
              <Button onClick={onClose}>
                <CheckCircle className="w-4 h-4 mr-1.5" /> Got it!
              </Button>
            ) : (
              <button onClick={() => setStep(s => s + 1)} className="flex items-center gap-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
