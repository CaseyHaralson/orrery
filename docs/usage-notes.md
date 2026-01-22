
this project hasn't yet been added to npm, but i'm assuming it has for the following steps.
so could use "npx orrery install-devcontainer" for example.

orrery steps (using linux devcontainer)
- use orrery to install devcontainer (if already have devcontainer, install orrery into it)
- update devcontainer
	- set agent priority
	- add firewall if needed
- open project in devcontainer
- sign into whatever agents you have
	- this uses a shared volume between containers, so only have to do this once
- use orrery to install skills
- either
	- run agent and use discover skill
	- copy docs/externally-building-a-plan-reference.md file to Claude/whereever and tell it to build a plan using that document as a reference
		- then use orrery to ingest the plan
- use orrery to simulate the plan
- when you are ready, use orrery to execute the plan


orrery steps (non-devcontainer)
- use orrery to install skills
- either
	- run agent and use discover skill
	- copy docs/externally-building-a-plan-reference.md file to Claude/whereever and tell it to build a plan using that document as a reference
		- then use orrery to ingest the plan
- use orrery to simulate the plan
- when you are ready, use orrery to execute the plan

