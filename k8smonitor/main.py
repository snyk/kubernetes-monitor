import time
import uuid
import json
import websocket

from k8smonitor import config
from k8smonitor import kubernetes_wrapper

myUuid = uuid.uuid4()

url = 'ws://%(hostname)s:%(port)s/api/v1/register/%(uuid)s' % {
  'hostname': config.KUBERNETES_AGENT['HOSTNAME'],
  'port': config.KUBERNETES_AGENT['PORT'],
  'uuid': str(myUuid),
}

print('attempting to connect to %s' % url)


# TODO error handling
while True:
    try:
      ws = wsConnection = websocket.create_connection(url)

      while True:
        res = ws.recv()
        print('RECEIVED', res)
        if res == 'COMMAND: DISCOVER':
          discovered = kubernetes_wrapper.discover()
          response = {
            'uuid': str(myUuid),
            'discover': discovered,
          }
          ws.send(json.dumps(response))
        else:
          ws.send('NO IDEA WHAT YOU WANT')

    except Exception as e:
      print('derp', e)
      time.sleep(1)


ws.close()
