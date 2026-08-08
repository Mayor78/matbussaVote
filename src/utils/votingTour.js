import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

let tourInstance = null;

export function startVotingTour() {
  if (tourInstance?.isActive()) return;

  const steps = [];

  if (document.getElementById('voting-progress-section')) {
    steps.push({
      element: '#voting-progress-section',
      popover: {
        title: 'Your Voting Progress',
        description: 'This shows how many positions you have voted for. Your goal is to complete all of them before the time runs out.',
        side: 'bottom',
        align: 'center',
      },
    });
  }

  const firstSection = document.getElementById('position-section-0');
  if (firstSection) {
    steps.push({
      element: '#position-section-0',
      popover: {
        title: 'Choose a Candidate',
        description: 'You will see candidates one position at a time. Swipe left or right on the cards to see all the candidates running for this position.',
        side: 'top',
        align: 'start',
      },
    });
  }

  steps.push(
    {
      popover: {
        title: 'Click a Candidate',
        description: 'Click on any candidate card to read about them. You will see their name, level, and what they promise to do if elected. Take your time to read before choosing.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      popover: {
        title: 'Confirm Your Choice',
        description: 'After clicking, a confirmation box will appear. Make sure you are happy with your choice — you CANNOT change your vote after confirming. Choose carefully!',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      popover: {
        title: 'All Done!',
        description: 'After voting for all positions, click "Finish Voting" at the bottom. Your votes are secret — no one can see who you voted for. Results will show on your dashboard when the election closes.',
        side: 'bottom',
        align: 'center',
      },
    }
  );

  tourInstance = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayClickNext: false,
    doneBtnText: 'Got it!',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    steps,
    onDestroyed: () => {
      tourInstance = null;
    },
  });

  tourInstance.drive();
}

export function stopVotingTour() {
  if (tourInstance?.isActive()) {
    tourInstance.destroy();
  }
}
