import type { Circus, } from "@jest/types"
import { TestEnvironment, } from "jest-environment-node"
// import TestEnvironment from "jest-environment-jsdom"

class FailFastEnvironment extends TestEnvironment
{
  failedTest = false

  async handleTestEvent(
    event: Circus.Event,
    state: Circus.State,
  )
  {
    if ( event.name === "hook_failure" || event.name === "test_fn_failure" )
    {
      this.failedTest = true
    } else if ( this.failedTest && event.name === "test_start" )
    {
      event.test.mode = "skip"
    }

    // @ts-ignore
    if ( super.handleTestEvent ) await super.handleTestEvent( event, state, )
  }
}

export default FailFastEnvironment
