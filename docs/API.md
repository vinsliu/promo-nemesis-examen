## Modules

<dl>
<dt><a href="#module_audit">audit</a></dt>
<dd></dd>
<dt><a href="#module_logger">logger</a></dt>
<dd></dd>
<dt><a href="#module_server">server</a></dt>
<dd></dd>
<dt><a href="#module_controllers/authController">controllers/authController</a></dt>
<dd></dd>
<dt><a href="#module_controllers/orderController">controllers/orderController</a></dt>
<dd></dd>
<dt><a href="#module_controllers/productController">controllers/productController</a></dt>
<dd></dd>
<dt><a href="#module_middlewares/authMiddleware">middlewares/authMiddleware</a></dt>
<dd></dd>
<dt><a href="#module_middlewares/authRateLimit">middlewares/authRateLimit</a></dt>
<dd></dd>
<dt><a href="#module_middlewares/validate">middlewares/validate</a></dt>
<dd></dd>
<dt><a href="#module_services/notifications">services/notifications</a></dt>
<dd></dd>
<dt><a href="#module_services/orderLifecycle">services/orderLifecycle</a></dt>
<dd></dd>
<dt><a href="#module_validation/schemas">validation/schemas</a></dt>
<dd><p>Schémas Joi de validation des entrées (inscription, connexion, commandes, statuts, stock).
Chaque export contient <code>body</code> et/ou <code>params</code>, utilisables avec <code>middlewares/validate</code>.</p>
</dd>
<dt><a href="#module_gateway">gateway</a></dt>
<dd></dd>
<dt><a href="#module_notifications">notifications</a></dt>
<dd></dd>
<dt><a href="#module_stock-management">stock-management</a></dt>
<dd></dd>
<dt><a href="#module_services/session">services/session</a></dt>
<dd></dd>
</dl>

<a name="module_audit"></a>

## audit
<a name="exp_module_audit--module.exports"></a>

### module.exports([req], action, outcome, [fields]) ⇒ <code>void</code> ⏏
Écrit un événement d'audit (type `audit`) dans le journal Pino.

**Kind**: Exported function  

| Param | Type | Description |
| --- | --- | --- |
| [req] | <code>express.Request</code> | Fournit `req.id` et l'utilisateur (`req.user.userId`). |
| action | <code>string</code> | Ex. `login`, `order_status`, `stock_update`. |
| outcome | <code>string</code> | Ex. `success`, `failure`. |
| [fields] | <code>object</code> | Champs additionnels non sensibles (`targetId`, `status`…). |

<a name="module_logger"></a>

## logger

* [logger](#module_logger)
    * [~createLogger([options])](#module_logger..createLogger) ⇒ <code>pino.Logger</code>
    * [~requestLogging([instance])](#module_logger..requestLogging) ⇒ <code>express.RequestHandler</code>
    * [~errorHandler(error, req, res, next)](#module_logger..errorHandler) ⇒ <code>void</code>

<a name="module_logger..createLogger"></a>

### logger~createLogger([options]) ⇒ <code>pino.Logger</code>
Crée un logger Pino JSON : champs `service` et `env`, niveau `LOG_LEVEL`, données sensibles masquées.

**Kind**: inner method of [<code>logger</code>](#module_logger)  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> |  |
| [options.level] | <code>string</code> | fatal, error, warn, info, debug, trace ou silent. |
| [options.destination] | <code>stream.Writable</code> | Sortie (stdout par défaut). |

<a name="module_logger..requestLogging"></a>

### logger~requestLogging([instance]) ⇒ <code>express.RequestHandler</code>
Middleware de journal HTTP : méthode, code de réponse, route et en-tête `X-Request-Id`.
N'écrit jamais d'en-têtes, de corps ni d'URL.

**Kind**: inner method of [<code>logger</code>](#module_logger)  

| Param | Type |
| --- | --- |
| [instance] | <code>pino.Logger</code> | 

<a name="module_logger..errorHandler"></a>

### logger~errorHandler(error, req, res, next) ⇒ <code>void</code>
Gestionnaire d'erreurs final : répond en JSON sans détail technique.

**Kind**: inner method of [<code>logger</code>](#module_logger)  

| Param | Type |
| --- | --- |
| error | <code>Error</code> | 
| req | <code>express.Request</code> | 
| res | <code>express.Response</code> | 
| next | <code>function</code> | 

<a name="module_server"></a>

## server
<a name="module_server..createApp"></a>

### server~createApp([options]) ⇒ <code>express.Express</code>
Construit l'application Express (helmet, CORS en liste blanche, cookies, routes, erreurs JSON).

**Kind**: inner method of [<code>server</code>](#module_server)  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> |  |
| [options.log] | <code>object</code> | Logger Pino injectable pour les tests. |

<a name="module_controllers/authController"></a>

## controllers/authController

* [controllers/authController](#module_controllers/authController)
    * [.login(req, res)](#module_controllers/authController.login) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.register(req, res)](#module_controllers/authController.register) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.logout(req, res)](#module_controllers/authController.logout) ⇒ <code>void</code>
    * [.me(req, res)](#module_controllers/authController.me) ⇒ <code>Promise.&lt;void&gt;</code>

<a name="module_controllers/authController.login"></a>

### controllers/authController.login(req, res) ⇒ <code>Promise.&lt;void&gt;</code>
Authentifie un utilisateur et pose le jeton JWT dans un cookie HttpOnly.
Répond 401 avec le même message pour un compte inconnu ou un mauvais mot de passe.

**Kind**: static method of [<code>controllers/authController</code>](#module_controllers/authController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> | `body` : `{ username, password }`. |
| res | <code>express.Response</code> | 200 `{ role, username, userId, expiresAt }`. |

<a name="module_controllers/authController.register"></a>

### controllers/authController.register(req, res) ⇒ <code>Promise.&lt;void&gt;</code>
Crée un compte avec le rôle `user` (le rôle n'est jamais lu dans la requête).
Le mot de passe exige 12 caractères, majuscule, minuscule, chiffre et caractère spécial.

**Kind**: static method of [<code>controllers/authController</code>](#module_controllers/authController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> | `body` : `{ username, email, password }`. |
| res | <code>express.Response</code> | 201 si créé, 409 si doublon, 400 si invalide. |

<a name="module_controllers/authController.logout"></a>

### controllers/authController.logout(req, res) ⇒ <code>void</code>
Efface le cookie de session.

**Kind**: static method of [<code>controllers/authController</code>](#module_controllers/authController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> |  |
| res | <code>express.Response</code> | 204. |

<a name="module_controllers/authController.me"></a>

### controllers/authController.me(req, res) ⇒ <code>Promise.&lt;void&gt;</code>
Retourne l'utilisateur de la session, relu en base (rôle à jour).

**Kind**: static method of [<code>controllers/authController</code>](#module_controllers/authController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> | Nécessite `authenticateToken`. |
| res | <code>express.Response</code> | 200 `{ userId, username, role }` ou 401. |

<a name="module_controllers/orderController"></a>

## controllers/orderController

* [controllers/orderController](#module_controllers/orderController)
    * _static_
        * [.createOrder(req, res)](#module_controllers/orderController.createOrder) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.deleteOrder(req, res)](#module_controllers/orderController.deleteOrder) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.getOrders(req, res)](#module_controllers/orderController.getOrders) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.validateOrder(req, res)](#module_controllers/orderController.validateOrder) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.updateOrderStatus(req, res)](#module_controllers/orderController.updateOrderStatus) ⇒ <code>Promise.&lt;void&gt;</code>
    * _inner_
        * [~changeStatus(req, res, orderId, status)](#module_controllers/orderController..changeStatus) ⇒ <code>Promise.&lt;void&gt;</code>

<a name="module_controllers/orderController.createOrder"></a>

### controllers/orderController.createOrder(req, res) ⇒ <code>Promise.&lt;void&gt;</code>
Crée une commande de façon idempotente (en-tête `Idempotency-Key` obligatoire).
Les prix viennent du catalogue, jamais du client ; le stock est réservé de façon atomique.

**Kind**: static method of [<code>controllers/orderController</code>](#module_controllers/orderController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> | `body` : `{ items, shippingAddress, paymentMethod, shippingMethod }`. |
| res | <code>express.Response</code> | 201 créée, 200 rejouée, 409 stock insuffisant ou clé réutilisée. |

<a name="module_controllers/orderController.deleteOrder"></a>

### controllers/orderController.deleteOrder(req, res) ⇒ <code>Promise.&lt;void&gt;</code>
Supprime une commande (administrateur) et restitue son stock. Refusé si expédiée ou livrée.

**Kind**: static method of [<code>controllers/orderController</code>](#module_controllers/orderController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> | `params.id` : identifiant de la commande. |
| res | <code>express.Response</code> | 204, 404 ou 409. |

<a name="module_controllers/orderController.getOrders"></a>

### controllers/orderController.getOrders(req, res) ⇒ <code>Promise.&lt;void&gt;</code>
Liste les commandes visibles (administrateur).

**Kind**: static method of [<code>controllers/orderController</code>](#module_controllers/orderController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> |  |
| res | <code>express.Response</code> | 200 tableau de commandes sans champs internes. |

<a name="module_controllers/orderController.validateOrder"></a>

### controllers/orderController.validateOrder(req, res) ⇒ <code>Promise.&lt;void&gt;</code>
Passe une commande à « En cours de traitement » (administrateur).

**Kind**: static method of [<code>controllers/orderController</code>](#module_controllers/orderController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> | `params.id`. |
| res | <code>express.Response</code> |  |

<a name="module_controllers/orderController.updateOrderStatus"></a>

### controllers/orderController.updateOrderStatus(req, res) ⇒ <code>Promise.&lt;void&gt;</code>
Change le statut d'une commande (administrateur).

**Kind**: static method of [<code>controllers/orderController</code>](#module_controllers/orderController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> | `params.orderId`, `body.status`. |
| res | <code>express.Response</code> |  |

<a name="module_controllers/orderController..changeStatus"></a>

### controllers/orderController~changeStatus(req, res, orderId, status) ⇒ <code>Promise.&lt;void&gt;</code>
Applique une transition de statut autorisée ; l'annulation restitue le stock.

**Kind**: inner method of [<code>controllers/orderController</code>](#module_controllers/orderController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> |  |
| res | <code>express.Response</code> |  |
| orderId | <code>string</code> | Identifiant de la commande. |
| status | <code>string</code> | Nouveau statut (voir `orderLifecycle.transitions`). |

<a name="module_controllers/productController"></a>

## controllers/productController

* [controllers/productController](#module_controllers/productController)
    * [.getProducts(req, res)](#module_controllers/productController.getProducts) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.updateProductStock(req, res)](#module_controllers/productController.updateProductStock) ⇒ <code>Promise.&lt;void&gt;</code>

<a name="module_controllers/productController.getProducts"></a>

### controllers/productController.getProducts(req, res) ⇒ <code>Promise.&lt;void&gt;</code>
Liste le catalogue (route publique).

**Kind**: static method of [<code>controllers/productController</code>](#module_controllers/productController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> |  |
| res | <code>express.Response</code> | 200 tableau de produits. |

<a name="module_controllers/productController.updateProductStock"></a>

### controllers/productController.updateProductStock(req, res) ⇒ <code>Promise.&lt;void&gt;</code>
Fixe le stock disponible d'un produit (administrateur), entier positif ou nul.

**Kind**: static method of [<code>controllers/productController</code>](#module_controllers/productController)  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> | `params.productId`, `body.stock`. |
| res | <code>express.Response</code> | 200, 400, 404 ou 409. |

<a name="module_middlewares/authMiddleware"></a>

## middlewares/authMiddleware

* [middlewares/authMiddleware](#module_middlewares/authMiddleware)
    * [.authenticateToken()](#module_middlewares/authMiddleware.authenticateToken) : <code>express.RequestHandler</code>
    * [.isAdmin()](#module_middlewares/authMiddleware.isAdmin) : <code>express.RequestHandler</code>

<a name="module_middlewares/authMiddleware.authenticateToken"></a>

### middlewares/authMiddleware.authenticateToken() : <code>express.RequestHandler</code>
Vérifie le JWT (cookie HttpOnly, sinon en-tête Bearer) et renseigne `req.user`.
Pour un cookie, exige `X-Requested-With: XMLHttpRequest` sur les méthodes modifiantes (CSRF).

**Kind**: static method of [<code>middlewares/authMiddleware</code>](#module_middlewares/authMiddleware)  
<a name="module_middlewares/authMiddleware.isAdmin"></a>

### middlewares/authMiddleware.isAdmin() : <code>express.RequestHandler</code>
Autorise uniquement le rôle `admin` ; à placer après `authenticateToken`.

**Kind**: static method of [<code>middlewares/authMiddleware</code>](#module_middlewares/authMiddleware)  
<a name="module_middlewares/authRateLimit"></a>

## middlewares/authRateLimit
<a name="module_middlewares/authRateLimit..createAuthRateLimit"></a>

### middlewares/authRateLimit~createAuthRateLimit(options) ⇒ <code>express.RequestHandler</code>
Crée un limiteur de tentatives en mémoire, par adresse du socket.

**Kind**: inner method of [<code>middlewares/authRateLimit</code>](#module_middlewares/authRateLimit)  
**Returns**: <code>express.RequestHandler</code> - Répond 429 avec `Retry-After` au-delà de la limite.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>object</code> |  |  |
| options.limit | <code>number</code> |  | Requêtes autorisées par fenêtre. |
| [options.windowMs] | <code>number</code> | <code>900000</code> | Durée de la fenêtre. |
| [options.maxEntries] | <code>number</code> | <code>10000</code> | Nombre maximal d'adresses suivies. |
| [options.now] | <code>function</code> |  | Horloge injectable pour les tests. |

<a name="module_middlewares/validate"></a>

## middlewares/validate
<a name="exp_module_middlewares/validate--module.exports"></a>

### module.exports(schema) ⇒ <code>express.RequestHandler</code> ⏏
Fabrique un middleware qui valide `req.params` et `req.body` avec des schémas Joi.
Retire les champs inconnus et répond 400 avec le premier message d'erreur.

**Kind**: Exported function  

| Param | Type | Description |
| --- | --- | --- |
| schema | <code>object</code> | Schémas Joi : `params` et/ou `body`. |

<a name="module_services/notifications"></a>

## services/notifications
<a name="exp_module_services/notifications--module.exports"></a>

### module.exports(message) ⇒ <code>Promise.&lt;axios.AxiosResponse&gt;</code> ⏏
Envoie une notification par e-mail via la gateway, authentifiée par `INTERNAL_API_TOKEN`.

**Kind**: Exported function  
**Throws**:

- <code>Error</code> Si la configuration est incomplète.


| Param | Type | Description |
| --- | --- | --- |
| message | <code>object</code> |  |
| [message.to] | <code>string</code> | Destinataire (par défaut `NOTIFICATION_EMAIL`). |
| message.subject | <code>string</code> |  |
| message.text | <code>string</code> |  |

<a name="module_services/orderLifecycle"></a>

## services/orderLifecycle

* [services/orderLifecycle](#module_services/orderLifecycle)
    * [~visible](#module_services/orderLifecycle..visible)
    * [~transitions](#module_services/orderLifecycle..transitions)
    * [~publicOrder(order)](#module_services/orderLifecycle..publicOrder) ⇒ <code>object</code>
    * [~reserve(order)](#module_services/orderLifecycle..reserve) ⇒ <code>Promise.&lt;void&gt;</code>
    * [~release(order)](#module_services/orderLifecycle..release) ⇒ <code>Promise.&lt;object&gt;</code>
    * [~discardMarkers(order)](#module_services/orderLifecycle..discardMarkers) ⇒ <code>Promise.&lt;void&gt;</code>
    * [~recoverOrders()](#module_services/orderLifecycle..recoverOrders) ⇒ <code>Promise.&lt;void&gt;</code>

<a name="module_services/orderLifecycle..visible"></a>

### services/orderLifecycle~visible
Filtre Mongo des commandes visibles (cycle de vie actif). @type {object}

**Kind**: inner constant of [<code>services/orderLifecycle</code>](#module_services/orderLifecycle)  
<a name="module_services/orderLifecycle..transitions"></a>

### services/orderLifecycle~transitions
Transitions de statut autorisées, par statut courant. @type {Object<string,string[]>}

**Kind**: inner constant of [<code>services/orderLifecycle</code>](#module_services/orderLifecycle)  
<a name="module_services/orderLifecycle..publicOrder"></a>

### services/orderLifecycle~publicOrder(order) ⇒ <code>object</code>
Retire les champs internes (clé d'idempotence, cycle de vie…) avant d'envoyer une commande au client.

**Kind**: inner method of [<code>services/orderLifecycle</code>](#module_services/orderLifecycle)  

| Param | Type | Description |
| --- | --- | --- |
| order | <code>object</code> | Document Mongoose ou objet simple. |

<a name="module_services/orderLifecycle..reserve"></a>

### services/orderLifecycle~reserve(order) ⇒ <code>Promise.&lt;void&gt;</code>
Réserve le stock de chaque ligne, de façon atomique par produit.

**Kind**: inner method of [<code>services/orderLifecycle</code>](#module_services/orderLifecycle)  
**Throws**:

- <code>Error</code> Erreur `status: 409` si le stock est insuffisant.


| Param | Type |
| --- | --- |
| order | <code>object</code> | 

<a name="module_services/orderLifecycle..release"></a>

### services/orderLifecycle~release(order) ⇒ <code>Promise.&lt;object&gt;</code>
Restitue le stock réservé (opération répétable) puis termine le cycle de vie de la commande.

**Kind**: inner method of [<code>services/orderLifecycle</code>](#module_services/orderLifecycle)  
**Returns**: <code>Promise.&lt;object&gt;</code> - La commande mise à jour.  

| Param | Type | Description |
| --- | --- | --- |
| order | <code>object</code> | Commande au cycle de vie `releasing`. |

<a name="module_services/orderLifecycle..discardMarkers"></a>

### services/orderLifecycle~discardMarkers(order) ⇒ <code>Promise.&lt;void&gt;</code>
Supprime les marqueurs de réservation d'une commande expédiée (le stock n'est jamais rendu).

**Kind**: inner method of [<code>services/orderLifecycle</code>](#module_services/orderLifecycle)  

| Param | Type |
| --- | --- |
| order | <code>object</code> | 

<a name="module_services/orderLifecycle..recoverOrders"></a>

### services/orderLifecycle~recoverOrders() ⇒ <code>Promise.&lt;void&gt;</code>
Termine les commandes interrompues. À lancer avant l'écoute, avec une seule instance.

**Kind**: inner method of [<code>services/orderLifecycle</code>](#module_services/orderLifecycle)  
<a name="module_validation/schemas"></a>

## validation/schemas
Schémas Joi de validation des entrées (inscription, connexion, commandes, statuts, stock).
Chaque export contient `body` et/ou `params`, utilisables avec `middlewares/validate`.

<a name="module_gateway"></a>

## gateway
<a name="module_gateway..createApp"></a>

### gateway~createApp([options]) ⇒ <code>express.Express</code>
Construit la gateway : relaie `/notify` vers le service de notifications (jeton interne requis).

**Kind**: inner method of [<code>gateway</code>](#module_gateway)  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> |  |
| [options.log] | <code>object</code> | Logger Pino. |

<a name="module_notifications"></a>

## notifications
<a name="module_notifications..createApp"></a>

### notifications~createApp([options]) ⇒ <code>express.Express</code>
Construit le service de notifications (`POST /notify`, protégé par `INTERNAL_API_TOKEN`).
Fournisseurs : `smtp` (Gmail) ou `resend`.

**Kind**: inner method of [<code>notifications</code>](#module_notifications)  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> |  |
| [options.env] | <code>object</code> | Variables d'environnement. |
| [options.fetchEmail] | <code>function</code> | `fetch` injectable (API Resend). |
| [options.createTransport] | <code>function</code> | Fabrique de transport nodemailer. |
| [options.log] | <code>object</code> | Logger Pino. |

<a name="module_stock-management"></a>

## stock-management
<a name="module_stock-management..createApp"></a>

### stock-management~createApp([options]) ⇒ <code>express.Express</code>
Construit le service de stock (point d'entrée `POST /update-stock`, simple accusé de réception).

**Kind**: inner method of [<code>stock-management</code>](#module_stock-management)  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> |  |
| [options.log] | <code>object</code> | Logger Pino. |

<a name="module_services/session"></a>

## services/session

* [services/session](#module_services/session)
    * [.saveSession()](#module_services/session.saveSession)
    * [.getSession()](#module_services/session.getSession) ⇒ <code>Object</code> \| <code>null</code>
    * [.clearSession()](#module_services/session.clearSession)
    * [.useSession()](#module_services/session.useSession)

<a name="module_services/session.saveSession"></a>

### services/session.saveSession()
Enregistre les informations d'affichage de la session (le jeton reste dans un cookie HttpOnly).

**Kind**: static method of [<code>services/session</code>](#module_services/session)  
<a name="module_services/session.getSession"></a>

### services/session.getSession() ⇒ <code>Object</code> \| <code>null</code>
**Kind**: static method of [<code>services/session</code>](#module_services/session)  
**Returns**: <code>Object</code> \| <code>null</code> - Session valide, sinon null.  
<a name="module_services/session.clearSession"></a>

### services/session.clearSession()
Efface la session locale et prévient les composants (événement `session-change`).

**Kind**: static method of [<code>services/session</code>](#module_services/session)  
<a name="module_services/session.useSession"></a>

### services/session.useSession()
Hook React : session courante, mise à jour à l'expiration ou à la déconnexion.

**Kind**: static method of [<code>services/session</code>](#module_services/session)  
