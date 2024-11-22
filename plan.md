# ENDPOINTS
## REST
### `POST /world`
Create a new world default: stopped 
- REQ BODY
    - `name`: string
    - `x`: integer
    - `y`: integer
    - `start`: boolean(optional)
- RES BODY
    - `200`
        - `id`: integer
        - `ok`: boolean(true)
    - `400` -> client error
        - `error`: string
        - `ok`: boolean(false)
    - `500` -> server error
        - `error`: string
        - `ok`: boolean(false)

### `GET /world`
Get all worlds
- RES BODY
    - `200`
        - array of
            - `id`: integer
            - `name`: string
            - `x`: integer
            - `y`: integer
            - `epoch`: uint64
            - `isRunning`: boolean
        - `ok`: boolean(true)
    - `500` -> server error
        - `error`: string
        - `ok`: boolean(false)

## WS
### `/world/{id}` - connect to `world` ws  
one may change the map when game is stopped  
#### data structure
1. Client -> Server
- `0x1000` - stop world
- `0x0001` - start world    
- `0x0002` - change world
    - `00` - flag `0x000200`
        - x,y pairs uint16 array
            - `0x0002004fa6e47d` -> [42575, 32228] -> 1

2. Server -> Client
- `0x8000` - world stopped
- `0x8001` - world started
- `0x8002` - world state
    - `0000000000000000` - epoch (uint64)
    - `00` - flag `0x800200` -> send only ones
        - x,y pairs uint16 array
            - `0x8002000000000000001004fa6e47d` -> filled only [42575, 32228] epoch 1

- `0x88ff` - error
    - `` - error text as json