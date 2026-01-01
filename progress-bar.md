1. There must be some type of animated progress bar that fills over time. It does not have to be directly tied to actual analysis progress, but it should reflect which stage of the analysis is currently taking place
2. The controls for animation should be handled on the front end. This implementation should be something like this:
- Backend says analysis is starting: progress bar fills up to 5% over 2 seconds
- Backend says github repo cloning is starting: progress bar fills up to 50% over 20 seconds (this happens regardless of how long the cloning actually takes)
- Backend says analysis is starting: progress bar fills up to 90% over 5 seconds (this happens regardless of how long the analysis actually takes)

3. Develop a strategy for how to implement this feature