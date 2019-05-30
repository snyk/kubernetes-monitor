import { post } from '../api';

export class Homebase {
  public sendDepGraph(graph: any) {
    post('https://homebase/api/v1/', {
      body: graph,
    });
  }
}
