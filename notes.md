- clean up workflow.md file and other unused files
- make sure readme looks good
- 
- executing plan agents don't have access to the web, so can't do research...
- 

test
- rename execute, report, and verify to have a prefix like orrery
  - might want to figure out the npm name for this project...


done
- failover to next agent didn't work
- the yaml thing removes comments and does other formatting
	- can it not do that?
- need to remove source_branch and work_branch from plan before trying to rerun
	- and change agent config back to correct order
- get gemini working in devcontainer
- make plan creation use same yaml project as post hook so plan doesn't change much during processing
- combine some report info into the plan and just save data to the plan
  - then remove report schema
- rename orchestrate command to "work" or "do-work"
- have an option to add a .devcontainer to the project
- make .devcontainer use shared volumes
- fix up where commit happens, make it happen during orchestrator? 
  - maybe the report makes the commit message and returns it in the report?



