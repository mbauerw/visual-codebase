Key issues to address:

1. Why is the backend sending frequent "status" requests? If these aren't accomplishing anything, it might be best to just remove them. 
2. Why is the backend not communicating to the frontend that LLM analysis has begun? There doesn't seem to be sufficient communication in terms of describing which point in the analysis flow the backend actually is. From a user perspective, the "Clone" phase takes up 99% of the total duration, even though in reality the clone phase only takes a few seconds and LLM analysis seems to take the most time (which is expected).
3. Create logs that track which phase the backend is in and append the logs to network-log.app in a similar fashion to how the cloing phase logs completion. 


