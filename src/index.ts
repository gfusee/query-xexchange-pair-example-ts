import {AbiRegistry, Address, QueryRunnerAdapter, SmartContractQueriesController} from "@multiversx/sdk-core/out"
import { promises } from "fs"
import {ProxyNetworkProvider} from "@multiversx/sdk-network-providers/out"

async function queryContract() {
    const queryRunner = new QueryRunnerAdapter({
        networkProvider: new ProxyNetworkProvider('https://gateway.multiversx.com')
    })

    const routerAbiJson = await promises.readFile("abis/router.abi.json", { encoding: "utf8" });
    const routerAbiObj = JSON.parse(routerAbiJson);
    const routerAbi = AbiRegistry.create(routerAbiObj);

    const routerController = new SmartContractQueriesController({
        queryRunner: queryRunner,
        abi: routerAbi
    })

    const getPairQuery = routerController.createQuery({
        contract: "erd1qqqqqqqqqqqqqpgqq66xk9gfr4esuhem3jru86wg5hvp33a62jps2fy57p",
        function: "getPair",
        arguments: [
            "WEGLD-bd4d79",
            "BOBER-9eb764"
        ]
    })

    let pairAddress = Address.empty()
    while (pairAddress.isEmpty()) {
        const getPairResponse = await routerController.runQuery(getPairQuery)
        const [pairAddressResponse] = routerController.parseQueryResponse(getPairResponse)

        pairAddress = pairAddressResponse

        await new Promise(f => setTimeout(f, 300))
    }

    const pairAbiJson = await promises.readFile("abis/pair.abi.json", { encoding: "utf8" });
    const pairAbiObj = JSON.parse(pairAbiJson);
    const pairAbi = AbiRegistry.create(pairAbiObj);

    const pairController = new SmartContractQueriesController({
        queryRunner: queryRunner,
        abi: pairAbi
    })

    const getStateQuery = pairController.createQuery({
        contract: pairAddress.bech32(),
        function: "getState",
        arguments: []
    })

    while(true) {
        const getStateResponse = await pairController.runQuery(getStateQuery)
        const [state] = pairController.parseQueryResponse(getStateResponse)

        if (state.name === "Active") {
            break
        }

        await new Promise(f => setTimeout(f, 300))
    }

    const getReserveQuery = pairController.createQuery({
        contract: pairAddress.bech32(),
        function: "getReserve",
        arguments: [
            "WEGLD-bd4d79"
        ]
    })
    const getReserveResponse = await pairController.runQuery(getReserveQuery)
    const [reserve] = pairController.parseQueryResponse(getReserveResponse)

    // `reserve` is a BigNumber,
    // comparing a BigNumber with a string works, but doing this is dirty.
    //
    // Use the BigNumber type instead of string to have a cleaner code.
    if (reserve < "1000000000000000000") {
        throw new Error("Insufficient WEGLD liquidity in the pool")
    }

    const getAmountOutQuery = pairController.createQuery({
        contract: pairAddress.bech32(),
        function: "getAmountOut",
        arguments: [
            "WEGLD-bd4d79",
            "10000000000000000000"
        ]
    })
    const getAmountOutResponse = await pairController.runQuery(getAmountOutQuery)
    const [amountOut] = pairController.parseQueryResponse(getAmountOutResponse)

    console.log(amountOut.toPrecision(28))
}

queryContract().then().catch()
