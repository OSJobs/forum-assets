/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
    locale = options.locale || I18n.currentLocale(),
    messages = translations[locale] || {},
    currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
    opts,
    count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
    placeholder,
    value,
    name;

  if (!matches) {
    return message;
  }

  for (var i = 0; (placeholder = matches[i]); i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(
      placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}")
    );
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== "en") {
      options.locale = "en";
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(options, this.lookup("number.format"), {
    precision: 3,
    separator: this.SEPARATOR,
    delimiter: ",",
    strip_insignificant_zeros: false
  });

  var negative = number < 0,
    string = Math.abs(number)
      .toFixed(options.precision)
      .toString(),
    parts = string.split(this.SEPARATOR),
    precision,
    buffer = [],
    formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length - 3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
      separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
      zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "");
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
    size = number,
    iterations = 0,
    unit,
    precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", { count: size });
    precision = 0;
  } else {
    unit = this.t(
      "number.human.storage_units.units." +
        [null, "kb", "mb", "gb", "tb"][iterations]
    );
    precision = size - Math.floor(size) === 0 ? 0 : 1;
  }

  options = this.prepareOptions(options, {
    precision: precision,
    format: "%n%u",
    delimiter: ""
  });

  number = this.toNumber(size, options);
  number = options.format.replace("%u", unit).replace("%n", number);

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = typeof key === "object" && key instanceof Array ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = "[" + this.currentLocale() + this.SEPARATOR + scope;
  if (key) {
    message += this.SEPARATOR + key;
  }
  return message + "]";
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value) {
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return "Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.";
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"logs_error_rate_notice.reached_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erro/hora";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erros/hora";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> alcançou o limite de configuração do site de ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erro/hora";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erros/hora";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erro/minuto";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erros/minuto";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> alcançou o limite de configuração do site de ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erro/minuto";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erros/minuto";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erro/hora";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erros/hora";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> ultrapassou o limite de configuração do site de ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erro/hora";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erros/hora";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erro/minuto";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erros/minuto";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> ultrapassou o limite de configuração do site de ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erro/minuto";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erros/minuto";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "topic.read_more_MF" : function(d){
var r = "";
r += "Há ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 não lido</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " não lidos</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "e ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>1 novo</a> tópico";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "e ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " novos</a> tópicos";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " restantes, ou ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "veja outros tópicos em ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "Você está prestes a remover ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> postagem";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> postagens";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " e ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> tópico";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> tópicos";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " deste usuário, removendo a conta, bloqueando cadastro a partir do endereço IP <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b>, e adicionando o e-mail dele <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["e-mail"];
r += "</b> em uma lista de bloqueio permanente. Você tem certeza que este usuário é realmente um spammer?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Este tópico tem ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 resposta";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " respostas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "com uma proporção alta de curtidas";
return r;
},
"med" : function(d){
var r = "";
r += "com uma proporção muito alta de curtidas";
return r;
},
"high" : function(d){
var r = "";
r += "com uma proporção extremamente alta de curtidas";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "Você está prestes a apagar ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 publicação";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " publicações";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 tópico";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " tópicos";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Você tem certeza?";
return r;
}, "too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "共有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.pt_BR = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"pt_BR":{"js":{"number":{"format":{"separator":",","delimiter":"."},"human":{"storage_units":{"format":"%n,%u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"HH:mm","time_with_zone":"HH:mm (z)","time_short_day":"ddd, HH:mm","timeline_date":"MMM YYYY","long_no_year_no_time":"D MMM","full_no_year_no_time":"D [de] MMMM","long_with_year":"D MMM, YYYY H:mm","long_with_year_no_time":"D MMM, YYYY","full_with_year_no_time":"D [de] MMMM, YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM, 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} atrás","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}m","other":"\u003c %{count}m"},"x_minutes":{"one":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"%{count}h","other":"%{count}h"},"x_days":{"one":"%{count}d","other":"%{count}d"},"x_months":{"one":"%{count} mês","other":"%{count} meses"},"about_x_years":{"one":"%{count}a","other":"%{count}a"},"over_x_years":{"one":"\u003e %{count}a","other":"\u003e %{count}a"},"almost_x_years":{"one":"%{count}a","other":"%{count}a"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} minuto","other":"%{count} minutos"},"x_hours":{"one":"%{count} hora","other":"%{count} horas"},"x_days":{"one":"%{count} dia","other":"%{count} dias"},"date_year":"D MMM, 'YY"},"medium_with_ago":{"x_minutes":{"one":"%{count} minuto atrás","other":"%{count} minutos atrás"},"x_hours":{"one":"%{count} hora atrás","other":"%{count} horas atrás"},"x_days":{"one":"%{count} dia atrás","other":"%{count} dias atrás"},"x_months":{"one":"%{count} mês atrás","other":"%{count} meses atrás"},"x_years":{"one":"%{count} ano atrás","other":"%{count} anos atrás"}},"later":{"x_days":{"one":"%{count} dia depois","other":"%{count} dias depois"},"x_months":{"one":"%{count} mês depois","other":"%{count} meses depois"},"x_years":{"one":"%{count} ano depois","other":"%{count} anos depois"}},"previous_month":"Mês Anterior","next_month":"Mês Seguinte","placeholder":"data"},"share":{"topic_html":"Tópico: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"postagem #%{postNumber}","close":"fechar","twitter":"Compartilhar este link no Twitter","facebook":"Compartilhar este link no Facebook","email":"Enviar este link em um e-mail"},"action_codes":{"public_topic":"tornou este tópico público em %{when}","private_topic":"tornou este tópico em uma mensagem pessoal %{when}","split_topic":"dividiu este tópico %{when}","invited_user":"convidou %{who} %{when}","invited_group":"convidou %{who} %{when}","user_left":"%{who} se removeram desta mensagem %{when}","removed_user":"removido %{who} %{when}","removed_group":"removido %{who} %{when}","autobumped":"automaticamente promovido %{when}","autoclosed":{"enabled":"fechou %{when}","disabled":"abriu %{when}"},"closed":{"enabled":"fechou %{when}","disabled":"abriu %{when}"},"archived":{"enabled":"arquivou %{when}","disabled":"desarquivou %{when}"},"pinned":{"enabled":"fixou %{when}","disabled":"desafixou %{when}"},"pinned_globally":{"enabled":"fixou globalmente %{when}","disabled":"desafixou %{when}"},"visible":{"enabled":"listou %{when}","disabled":"desalistou %{when}"},"banner":{"enabled":"tornou isto um banner %{when}. Isto será mostrado no topo de todas as páginas até que seja descartado pelo usuário.","disabled":"removeu este banner %{when}. Ele não vai mais aparecer no topo de todas as páginas."},"forwarded":"encaminhado o e-mail acima"},"topic_admin_menu":"ações de tópico","wizard_required":"Bem vindo ao seu novo Discourse! Vamos começar com o \u003ca href='%{url}' data-auto-route='true'\u003eassistente de configuração\u003c/a\u003e ✨","emails_are_disabled":"Todo o envio de e-mail foi globalmente desabilitado por um administrador. Nenhum e-mail de notificações de qualquer tipo será enviado.","bootstrap_mode_enabled":"Para facilitar o lançamento do seu novo site, você está no modo de bootstrap. Todos os novos usuários receberão o nível de confiança 1 e terão os e-mails diários de resumo ativados. Isso será desativado automaticamente quando %{min_users} usuários se registrarem.","bootstrap_mode_disabled":"O modo bootstrap será desativado em 24 horas.","themes":{"default_description":"Padrão","broken_theme_alert":"Seu site pode não funcionar porque o tema / componente %{theme} tem erros. Desabilite-o em %{path}."},"s3":{"regions":{"ap_northeast_1":"Ásia Pacífico (Tóquio)","ap_northeast_2":"Ásia Pacífico (Seul)","ap_south_1":"Ásia-Pacífico (Mumbai)","ap_southeast_1":"Ásia Pacífico (Singapura)","ap_southeast_2":"Ásia Pacífico (Sidney)","ca_central_1":"Canadá (Central)","cn_north_1":"China (Beijing)","cn_northwest_1":"China (Ningxia)","eu_central_1":"UE (Frankfurt)","eu_north_1":"UE (Estocolmo)","eu_west_1":"UE (Irlanda)","eu_west_2":"UE (Londres)","eu_west_3":"UE (Paris)","sa_east_1":"América do Sul (São Paulo)","us_east_1":"Leste do EUA (N. da Virgínia)","us_east_2":"Leste do EUA (Ohio)","us_gov_east_1":"AWS GovCloud (Leste do EUA)","us_gov_west_1":"AWS GovCloud (EUA-Oeste)","us_west_1":"Oeste do EUA (N. da Califórnia)","us_west_2":"Oeste do EUA (Oregon)"}},"edit":"edite o título e a categoria deste tópico","expand":"Expandir","not_implemented":"Este recurso ainda não foi implementado, desculpe!","no_value":"Não","yes_value":"Sim","submit":"Enviar","generic_error":"Pedimos desculpa, ocorreu um erro.","generic_error_with_reason":"Ocorreu um erro: %{error}","go_ahead":"Continue","sign_up":"Cadastrar-se","log_in":"Entrar","age":"Idade","joined":"Registrou","admin_title":"Admin","show_more":"mostrar mais","show_help":"opções","links":"Links","links_lowercase":{"one":"link","other":"links"},"faq":"FAQ","guidelines":"Diretrizes","privacy_policy":"Política de Privacidade","privacy":"Privacidade","tos":"Termos de Serviço","rules":"Regras","conduct":"Código de Conduta","mobile_view":"VIsualização Móvel","desktop_view":"Visualização Desktop","you":"Você","or":"ou","now":"agora","read_more":"leia mais","more":"Mais","less":"Menos","never":"nunca","every_30_minutes":"a cada 30 minutos","every_hour":"a cada hora","daily":"diário","weekly":"semanal","every_month":"a cada mês","every_six_months":"a cada seis meses","max_of_count":"máx de {{count}}","alternation":"ou","character_count":{"one":"{{count}} caracter","other":"{{count}} caracteres"},"related_messages":{"title":"Mensagens Relacionadas","see_all":"Ver \u003ca href=\"%{path}\"\u003etodas as mensagens\u003c/a\u003e de @ %{username} ..."},"suggested_topics":{"title":"Tópicos Sugeridos","pm_title":"Mensagens Sugeridas"},"about":{"simple_title":"Sobre","title":"Sobre %{title}","stats":"Estatísticas do Site","our_admins":"Nossos Administradores","our_moderators":"Nossos Moderadores","moderators":"Moderadores","stat":{"all_time":"Desde o Começo","last_7_days":"Últimos 7","last_30_days":"Últimos 30"},"like_count":"Curtidas","topic_count":"Tópicos","post_count":"Mensagens","user_count":"Usuários","active_user_count":"Usuários Ativos","contact":"Contate-nos","contact_info":"Em caso de um evento crítico ou de urgência afetando este site, por favor nos contate em %{contact_info}."},"bookmarked":{"title":"Favorito","clear_bookmarks":"Limpar Favoritos","help":{"bookmark":"Clique para adicionar o primeiro post deste tópico aos favoritos","unbookmark":"Clique para remover todos os favoritos neste tópico"}},"bookmarks":{"created":"você marcou esta postagem como favorita","not_bookmarked":"marcar postagem como favorita","created_with_at_desktop_reminder":"você marcou esta postagem como favorita e será lembrado na próxima vez em que estiver em sua área de trabalho","remove":"Remover Favorito","confirm_clear":"Você tem certeza de que deseja apagar todos os seus favoritos deste tópico?","save":"Salvar","no_timezone":"Você ainda não definiu um fuso horário. VOcê não poderá definir lembretes. Configure um \u003ca href=\"%{basePath}/my/preferences/profile\"\u003eno seu perfil\u003c/a\u003e.","invalid_custom_datetime":"A data e a hora que você forneceu são inválidas, por favor tente novamente.","list_permission_denied":"Você não tem permissão para visualizar os favoritos deste usuário.","reminders":{"at_desktop":"Da próxima vez que estiver na minha área de trabalho","later_today":"Mais tarde hoje","tomorrow":"Amanhã","next_week":"Próxima semana","later_this_week":"Mais tarde nesta semana","next_month":"Próximo mês","custom":"Data e hora personalizadas","none":"Nenhum lembrete necessário"}},"drafts":{"resume":"Resumir","remove":"Remova","new_topic":"Novo rascunho de tópico","new_private_message":"Novo rascunho de mensagem privada","topic_reply":"Resposta rascunho","abandon":{"confirm":"Você já abriu outro rascunho neste tópico. Você tem certeza de que deseja descartá-lo?","yes_value":"Sim, descartar.","no_value":"Não, manter."}},"topic_count_latest":{"one":"Veja {{count}} tópico novo ou atualizado","other":"Veja {{count}} tópicos novos ou atualizados"},"topic_count_unread":{"one":"Veja {{count}} tópico não lido","other":"Veja {{count}} tópicos não lidos"},"topic_count_new":{"one":"Veja {{count}} novo tópico","other":"Veja {{count}} novos tópicos"},"preview":"pré-visualização","cancel":"cancelar","save":"Salvar Mudanças","saving":"Salvando...","saved":"Salvo!","upload":"Enviar","uploading":"Enviando...","uploading_filename":"Enviando: {{filename}}...","clipboard":"área de transferência","uploaded":"Enviado!","pasting":"Colando...","enable":"Habilitar","disable":"Desabilitar","continue":"Continuar","undo":"Desfazer","revert":"Reverter","failed":"Falhou","switch_to_anon":"Entrar no Modo Anônimo","switch_from_anon":"Sair do Modo Anônimo","banner":{"close":"Ignorar este banner.","edit":"Editar este banner \u003e\u003e"},"pwa":{"install_banner":"Você quer \u003ca href\u003einstalar %{title} no seu dispositivo?\u003c/a\u003e"},"choose_topic":{"none_found":"Nenhum tópico encontrado.","title":{"search":"Pesquisar um tópico","placeholder":"digite o título do tópico, URL ou ID aqui"}},"choose_message":{"none_found":"Nenhuma mensagem encontrada.","title":{"search":"Pesquisar mensagem","placeholder":"digite o título da mensagem, URL ou ID aqui"}},"review":{"order_by":"Ordenar por","in_reply_to":"Em resposta a","explain":{"why":"explique por que esse item terminou na fila","title":"Pontuação Revisável","formula":"Fórmula","subtotal":"Subtotal","total":"Total","min_score_visibility":"Pontuação mínima para visibilidade","score_to_hide":"Pontuação para ocultar postagem","take_action_bonus":{"name":"tomou medidas","title":"Quando um membro da equipe decide agir, a bandeira recebe um bônus."},"user_accuracy_bonus":{"name":"precisão do usuário","title":"Os usuários cujas bandeiras foram historicamente acordadas recebem um bônus."},"trust_level_bonus":{"name":"nível de confiança","title":"Itens revisáveis criados por usuários com nível de confiança mais alto têm uma pontuação mais alta."},"type_bonus":{"name":"tipo de bônus","title":"Certos tipos passíveis de revisão podem receber um bônus da equipe para torná-los uma prioridade mais alta."}},"claim_help":{"optional":"Você pode reivindicar este item para impedir que outras pessoas o revisem.","required":"Você precisa reivindicar itens antes de poder revisá-los.","claimed_by_you":"Você reivindicou este item e pode revisá-lo.","claimed_by_other":"Este item só pode ser revisado por \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"reivindicar este tópico"},"unclaim":{"help":"remover esta reivindicação"},"awaiting_approval":"Aguardando Aprovação","delete":"Excluir","settings":{"saved":"Salvo","save_changes":"Salvar Mudanças","title":"Configurações","priorities":{"title":"Prioridades Revisáveis"}},"moderation_history":"Histórico de Moderação","view_all":"Visualizar Todos","grouped_by_topic":"Agrupado por Tópico","none":"Não há itens para revisar.","view_pending":"visualização pendente","topic_has_pending":{"one":"Este tópico tem \u003cb\u003e%{count}\u003c/b\u003e postagem pendente de aprovação","other":"Este tópico tem \u003cb\u003e{{count}}\u003c/b\u003e postagens pendentes de aprovação"},"title":"Revisar","topic":"Tópico:","filtered_topic":"Você filtrou para conteúdo de revisão em um único tópico.","filtered_user":"Usuário","show_all_topics":"mostrar todos os tópicos","deleted_post":"(postagem excluída)","deleted_user":"(usuário excluído)","user":{"bio":"Bio","website":"Website","username":"Nome de Usuário","email":"E-mail","name":"Nome","fields":"Campos"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} sinalização no total)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} sinalizações no total)"},"agreed":{"one":"{{count}}% concorda","other":"{{count}}% concordam"},"disagreed":{"one":"{{count}}% discorda","other":"{{count}}% discordam"},"ignored":{"one":"{{count}}% ignora","other":"{{count}}% ignoram"}},"topics":{"topic":"Tópico","reviewable_count":"Contagem","reported_by":"Reportado por","deleted":"[Tópico Excluído]","original":"(tópico original)","details":"detalhes","unique_users":{"one":"%{count} usuário","other":"{{count}} usuários"}},"replies":{"one":"%{count} resposta","other":"{{count}} respostas"},"edit":"Editar","save":"Salvar","cancel":"Cancelar","new_topic":"A aprovação deste item criará um novo tópico","filters":{"all_categories":"(todas as categorias)","type":{"title":"Tipo","all":"(todos os tipos)"},"minimum_score":"Pontuação Mínima:","refresh":"Atualizar","status":"Status","category":"Categoria","orders":{"priority":"Prioridade","priority_asc":"Prioridade (reversa)","created_at":"Criado a","created_at_asc":"Criado Em (reverso)"},"priority":{"title":"Prioridade Mínima","low":"(qualquer)","medium":"Média","high":"Alta"}},"conversation":{"view_full":"visualizar conversa completa"},"scores":{"about":"Essa pontuação é calculada com base no nível de confiança do relator, na precisão de suas sinalizações anteriores e na prioridade do item que está sendo reportado.","score":"Pontuação","date":"Data","type":"Tipo","status":"Status","submitted_by":"Submetido Por","reviewed_by":"Revisado Por"},"statuses":{"pending":{"title":"Pendentes"},"approved":{"title":"Aprovado"},"rejected":{"title":"Rejeitados"},"ignored":{"title":"Ignorados"},"deleted":{"title":"Excluído"},"reviewed":{"title":"(Tudo Revisado)"},"all":{"title":"(tudo)"}},"types":{"reviewable_flagged_post":{"title":"Postagem Sinalizada","flagged_by":"Sinalizado por"},"reviewable_queued_topic":{"title":"Tópico Enfileirado"},"reviewable_queued_post":{"title":"Postagem Enfileirada"},"reviewable_user":{"title":"Usuário"}},"approval":{"title":"Postagem Precisa de Aprovação","description":"Nós recebemos sua nova postagem, mas é necessário que seja aprovada por um moderador antes de ser exibida. Por favor, tenha paciência.","pending_posts":{"one":"Você tem \u003cstrong\u003e%{count}\u003c/strong\u003e postagem pendente.","other":"Você tem postagens \u003cstrong\u003e{{count}}\u003c/strong\u003e pendentes."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e postou \u003ca href='{{topicUrl}}'\u003eo tópico\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eVocê\u003c/a\u003e postou \u003ca href='{{topicUrl}}'\u003eo tópico\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondeu \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eVocê\u003c/a\u003e respondeu a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondeu ao \u003ca href='{{topicUrl}}'\u003etópico\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eVocê\u003c/a\u003e respondeu ao \u003ca href='{{topicUrl}}'\u003etópico\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003evocê\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eVocê\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Postado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Postado por \u003ca href='{{userUrl}}'\u003evocê\u003c/a\u003e","sent_by_user":"Enviado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Enviado por \u003ca href='{{userUrl}}'\u003evocê\u003c/a\u003e"},"directory":{"filter_name":"filtrar por nome de usuário","title":"Usuários","likes_given":"Dados","likes_received":"Recebidos","topics_entered":"Visualizados","topics_entered_long":"Tópicos Vizualizados","time_read":"Tempo Lido","topic_count":"Tópicos","topic_count_long":"Tópicos Criados","post_count":"Respostas","post_count_long":"Respostas Postadas","no_results":"Nenhum resultado foi encontrado.","days_visited":"Visitas","days_visited_long":"Dias Visitados","posts_read":"Lidos","posts_read_long":"Postagens Lidas","total_rows":{"one":"%{count} usuário","other":"%{count} usuários"}},"group_histories":{"actions":{"change_group_setting":"Alterar configurações do grupo","add_user_to_group":"Adicionar usuário","remove_user_from_group":"Remover usuário","make_user_group_owner":"Tornar proprietário","remove_user_as_group_owner":"Revogar proprietário"}},"groups":{"member_added":"Adicionado","member_requested":"Solicitado em","add_members":{"title":"Adicionar membros","description":"Gerenciar a associação deste grupo","usernames":"Nomes de usuários"},"requests":{"title":"Solicitações","reason":"Motivo","accept":"Aceitar","accepted":"aceito","deny":"Negar","denied":"negado","undone":"solicitação desfeita","handle":"tratar pedido de associação"},"manage":{"title":"Gerenciar","name":"Nome","full_name":"Nome Completo","add_members":"Adicionar membros","delete_member_confirm":"Remover '%{username}' do '%{group}' grupo?","profile":{"title":"Perfil"},"interaction":{"title":"Interação","posting":"Postando","notification":"Notificação"},"membership":{"title":"Associação","access":"Acesso"},"logs":{"title":"Registros","when":"Quando","action":"Ação","acting_user":"Usuário agindo","target_user":"Usuário alvo","subject":"Assunto","details":"Detalhes","from":"De","to":"Para"}},"public_admission":"Permitir que os usuários entrem no grupo livremente (Requer grupo publicamente visível)","public_exit":"Permitir que os usuários saiam do grupo livremente","empty":{"posts":"Não há publicações de membros deste grupo.","members":"Não há membros neste grupo.","requests":"Não há solicitações de associação para este grupo.","mentions":"Não há menções a este grupo.","messages":"Não há mensagens para este grupo.","topics":"Não há tópicos de membros deste grupo.","logs":"Não há registros para este grupo."},"add":"Adicionar","join":"Entrar","leave":"Sair","request":"Solicitar","message":"Mensagem","confirm_leave":"Tem certeza de que deseja sair desse grupo?","allow_membership_requests":"Permitir que usuários enviem pedidos de adesão a donos do grupo (Requer grupo visível ao público)","membership_request_template":"Modelo personalizado para exibir aos usuários ao enviar uma solicitação de associação","membership_request":{"submit":"Enviar Solicitação","title":"Pedir para entrar no grupo @%{group_name}","reason":"Diga aos proprietários do grupo por que você pertence a este grupo"},"membership":"Associação","name":"Nome","group_name":"Nome do grupo","user_count":"Usuários","bio":"Sobre o Grupo","selector_placeholder":"insira nome de usuário","owner":"proprietário","index":{"title":"Grupos","all":"Todos os Grupos","empty":"Não há grupos visíveis.","filter":"Filtrar por tipo de grupo","owner_groups":"Grupos que eu possuo","close_groups":"Grupos Fechados","automatic_groups":"Grupos Automáticos","automatic":"Automático","closed":"Fechado","public":"Público","private":"Privado","public_groups":"Grupos Públicos","automatic_group":"Grupo Automático","close_group":"Fechar Grupo","my_groups":"Meus Grupos","group_type":"Tipo de grupo","is_group_user":"Membro","is_group_owner":"Proprietário"},"title":{"one":"Grupos ","other":"Grupos"},"activity":"Atividade","members":{"title":"Membros","filter_placeholder_admin":"nome de usuário ou e-mail","filter_placeholder":"nome de usuário","remove_member":"Remover Membro","remove_member_description":"Remover \u003cb\u003e%{username}\u003c/b\u003e deste grupo","make_owner":"Tornar Proprietário","make_owner_description":"Tornar \u003cb\u003e%{username}\u003c/b\u003e um proprietário deste grupo","remove_owner":"Remover como Proprietário","remove_owner_description":"Remover \u003cb\u003e%{username}\u003c/b\u003e como um proprietário deste grupo","owner":"Proprietário","forbidden":"Você não tem permissão para visualizar os membros."},"topics":"Tópicos","posts":"Postagens","mentions":"Menções","messages":"Mensagens","notification_level":"Nível de notificação padrão para mensagens de grupo","alias_levels":{"mentionable":"Quem pode @mencionar este grupo?","messageable":"Quem pode enviar mensagens para este grupo?","nobody":"Ninguém","only_admins":"Somente administradores","mods_and_admins":"Somente moderadores e administradores","members_mods_and_admins":"Somente membros do grupo, moderadores e administradores","owners_mods_and_admins":"Somente proprietários do grupo, moderadores e administradores","everyone":"Todos"},"notifications":{"watching":{"title":"Observando","description":"Você será notificado sobre toda nova postagem em cada mensagem, e uma contagem de novas respostas será mostrada."},"watching_first_post":{"title":"Observando Primeira Postagem","description":"Você será notificado sobre novas mensagens neste grupo, mas não sobre respostas às mensagens."},"tracking":{"title":"Acompanhando","description":"Você será notificado se alguém mencionar seu @nome ou te responder, e uma contagem de novas respostas será mostrada."},"regular":{"title":"Normal","description":"Você será notificado se alguém mencionar seu @nome ou te responder."},"muted":{"title":"Silenciado","description":"Você não será notificado de nada sobre mensagens neste grupo."}},"flair_url":"Imagem do Avatar Flair","flair_url_placeholder":"(Opcional) URL da imagem ou classe do Font Awesome","flair_url_description":"Use imagens quadradas não menores que 20px por 20px ou ícones FontAwesome (formatos aceitos: \"fa-icon\", \"far fa-icon\" ou \"fab fa-icon\").","flair_bg_color":"Cor de Fundo do Avatar Flair","flair_bg_color_placeholder":"(Opcional) Valor da cor em hexadecimal","flair_color":"Cor do Avatar Flair","flair_color_placeholder":"(Opcional) Valor da cor em hexadecimal","flair_preview_icon":"Pré-visualizar Ícone","flair_preview_image":"Pré-visualizar Imagem"},"user_action_groups":{"1":"Curtidas dadas","2":"Curtidas recebidas","3":"Favoritos","4":"Tópicos","5":"Respostas","6":"Respostas","7":"Menções","9":"Citações","11":"Edições","12":"Itens Enviados","13":"Caixa de Entrada","14":"Pendente","15":"Rascunhos"},"categories":{"all":"todas as categorias","all_subcategories":"todos","no_subcategory":"nenhum","category":"Categoria","category_list":"Exibir lista de categorias","reorder":{"title":"Reordenar Categorias","title_long":"Reorganizar a lista de categorias","save":"Salvar Ordem","apply_all":"Aplicar","position":"Posição"},"posts":"Postagens","topics":"Tópicos","latest":"Últimos","latest_by":"últimos por","toggle_ordering":"alternar controle de ordenação","subcategories":"Subcategorias","topic_sentence":{"one":"%{count} tópico","other":"%{count} tópicos"},"topic_stat_sentence_week":{"one":"%{count} novo tópico na última semana.","other":"%{count} novos tópicos na última semana."},"topic_stat_sentence_month":{"one":"%{count} novo tópico no último mês.","other":"%{count} novos tópicos no último mês."},"n_more":"Categorias (mais %{count}) ..."},"ip_lookup":{"title":"Pesquisa do Endereço de IP","hostname":"Nome do host","location":"Localização","location_not_found":"(desconhecido)","organisation":"Organização","phone":"Telefone","other_accounts":"Outras contas com este endereço de IP:","delete_other_accounts":"Excluir %{count}","username":"nome de usuário","trust_level":"NC","read_time":"tempo de leitura","topics_entered":"tópicos em que entrou","post_count":"# postagens","confirm_delete_other_accounts":"Você tem certeza de que deseja excluir estas contas?","powered_by":"usando \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"copiado"},"user_fields":{"none":"(selecione uma opção)"},"user":{"said":"{{username}}:","profile":"Perfil","mute":"Silenciar","edit":"Editar Preferências","download_archive":{"button_text":"Baixar Tudo","confirm":"Você tem certeza de que deseja baixar as suas postagens?","success":"Transferência iniciada, você será notificado por mensagem quando o processo estiver completo.","rate_limit_error":"Postagens podem ser baixadas somente uma vez por dia, por favor tente novamente amanhã."},"new_private_message":"Nova Mensagem","private_message":"Mensagem","private_messages":"Mensagens","user_notifications":{"ignore_duration_title":"Ignorar Temporizador","ignore_duration_username":"Nome de Usuário","ignore_duration_when":"Duração:","ignore_duration_save":"Ignorar","ignore_duration_note":"Por favor, note que todos os ignorar são automaticamente removidos após a expiração da duração do ignorar.","ignore_duration_time_frame_required":"Por favor selecione um período de tempo","ignore_no_users":"Você não tem usuários ignorados.","ignore_option":"Ignorados","ignore_option_title":"Você não receberá notificações relacionadas a este usuário e todos os tópicos e respostas serão ocultados.","add_ignored_user":"Adicionar...","mute_option":"Silenciados","mute_option_title":"Você não receberá notificações relacionadas a este usuário.","normal_option":"Normal","normal_option_title":"Você será notificado se este usuário responder a você, citá-lo ou mencioná-lo."},"activity_stream":"Atividade","preferences":"Preferências","feature_topic_on_profile":{"open_search":"Selecione um Novo Tópico","title":"Selecione um Tópico","search_label":"Pesquisar tópico por título","save":"Salvar","clear":{"title":"Limpo","warning":"Tem certeza de que deseja limpar o tópico em destaque?"}},"profile_hidden":"O perfil público deste usuário está oculto.","expand_profile":"Expandir","collapse_profile":"Recolher","bookmarks":"Favoritos","bio":"Sobre mim","timezone":"Fuso Horário","invited_by":"Convidado Por","trust_level":"Nível de Confiança","notifications":"Notificações","statistics":"Estatísticas","desktop_notifications":{"label":"Notificações Ao Vivo","not_supported":"Notificações não são suportadas neste navegador. Desculpe.","perm_default":"Habilitar Notificações","perm_denied_btn":"Permissão Negada","perm_denied_expl":"Você negou permissão para notificações. Permita notificações nas configurações do seu navegador.","disable":"Desativar Notificações","enable":"Ativar Notificações","each_browser_note":"Obs.: Você deve modificar esta configuração em todos os navegadores que você usa.","consent_prompt":"Você quer notificações ao vivo quando as pessoas respondem às suas postagens?"},"dismiss":"Descartar","dismiss_notifications":"Descartar Tudo","dismiss_notifications_tooltip":"Marcar todas as notificações não lidas como lidas","first_notification":"Sua primeira notificação! Selecione-a para começar.","dynamic_favicon":"Mostrar contagens no ícone do navegador","theme_default_on_all_devices":"Definir este tema como padrão em todos os meus dispositivos","text_size_default_on_all_devices":"Definir este tamanho de texto como padrão em todos os meus dispositivos","allow_private_messages":"Permitir que outros usuários me enviem mensagens pessoais","external_links_in_new_tab":"Abrir todos os links externos em uma nova aba","enable_quoting":"Habilitar resposta citando o texto destacado","enable_defer":"Habilitar adiar para marcar tópicos não lidos","change":"alterar","featured_topic":"Tópico em Destaque","moderator":"{{user}} é um moderador","admin":"{{user}} é um administrador","moderator_tooltip":"Este usuário é um moderador","admin_tooltip":"Este usuário é um administrador","silenced_tooltip":"Este usuário está silenciado","suspended_notice":"Este usuário está suspenso até {{date}}.","suspended_permanently":"Este usuário está suspenso.","suspended_reason":"Motivo:","github_profile":"Github","email_activity_summary":"Resumo de Atividades","mailing_list_mode":{"label":"Modo lista de correio","enabled":"Habilitar modo lista de correio","instructions":"Esta opção substitui o resumo de atividades.\u003cbr /\u003e\nTópicos e categorias silenciadas não são incluídas nestes e-mails.\n","individual":"Enviar um e-mail para cada postagem nova","individual_no_echo":"Enviar um e-mail para cada postagem nova, exceto as minhas","many_per_day":"Me envie um e-mail para cada nova postagem (aproximadamente {{dailyEmailEstimate}} por dia)","few_per_day":"Me envie um e-mail para cada nova postagem (aproximadamente 2 por dia)","warning":"Modo de lista de correio habilitado. As configurações de notificação por e-mail são substituídas."},"tag_settings":"Etiquetas","watched_tags":"Observadas","watched_tags_instructions":"Você irá observar automaticamente todos os tópicos com estas etiquetas. Você será notificado de todas as novas postagens e tópicos, e uma contagem de postagens novas também aparecerá ao lado do tópico.","tracked_tags":"Acompanhadas","tracked_tags_instructions":"Você irá acompanhar automaticamente todos os tópicos com estas etiquetas. Uma contagem de postagens novas aparecerá ao lado do tópico.","muted_tags":"Silenciadas","muted_tags_instructions":"Você não será notificado sobre novos tópicos com estas etiquetas, e eles não aparecerão em últimos.","watched_categories":"Observadas","watched_categories_instructions":"Você irá observar automaticamente todos os tópicos nestas categorias. Você será notificado de todas as novas postagens e tópicos, e uma contagem de postagens novas também aparecerá ao lado do tópico.","tracked_categories":"Acompanhadas","tracked_categories_instructions":"Você irá acompanhar automaticamente todos os tópicos nestas categorias. Uma contagem de postagens novas aparecerá ao lado do tópico.","watched_first_post_categories":"Observando Primeira Postagem","watched_first_post_categories_instructions":"Você será notificado sobre a primeira postagem em cada tópico novo nestas categorias.","watched_first_post_tags":"Observando Primeira Postagem","watched_first_post_tags_instructions":"Você será notificado sobre a primeira postagem em cada tópico novo com estas etiquetas.","muted_categories":"Silenciadas","muted_categories_instructions":"Você não será notificado de nada sobre novos tópicos nestas categorias, e eles não aparecerão nas categorias ou nas últimas páginas.","muted_categories_instructions_dont_hide":"Você não será notificado de nada sobre novos tópicos nestas categorias.","no_category_access":"Como um moderador, você tem acesso limitado à categorias, salvar está desabilitado.","delete_account":"Excluir Minha Conta","delete_account_confirm":"Você tem certeza de que deseja permanentemente excluir a sua conta? Esta ação não pode ser desfeita!","deleted_yourself":"Sua conta foi excluída com sucesso.","delete_yourself_not_allowed":"Por favor, entre em contato com um membro da staff se você deseja que a sua conta seja excluída.","unread_message_count":"Mensagens","admin_delete":"Excluir","users":"Usuários","muted_users":"Silenciados","muted_users_instructions":"Suprimir todas as notificações destes usuários.","ignored_users":"Ignorados","ignored_users_instructions":"Suprimir todas as postagens e notificações destes usuários.","tracked_topics_link":"Exibir","automatically_unpin_topics":"Desafixar automaticamente os tópicos quando eu chegar no final deles.","apps":"Aplicativos","revoke_access":"Revogar Acesso","undo_revoke_access":"Desfazer a Revogação de Acesso","api_approved":"Aprovada:","api_last_used_at":"Usada pela última vez em:","theme":"Tema","home":"Página Inicial Padrão","staged":"Fictício","staff_counters":{"flags_given":"sinalizações úteis","flagged_posts":"postagens sinalizadas","deleted_posts":"postagens excluídas","suspensions":"suspensões","warnings_received":"avisos","rejected_posts":"postagens rejeitadas"},"messages":{"all":"Todas","inbox":"Caixa de entrada","sent":"Enviadas","archive":"Arquivo","groups":"Meus Grupos","bulk_select":"Selecionar mensagens","move_to_inbox":"Mover para Caixa de entrada","move_to_archive":"Arquivar","failed_to_move":"Falha ao mover as mensagens selecionadas (talvez você esteja sem conexão com a Internet)","select_all":"Selecionar Tudo","tags":"Etiquetas"},"preferences_nav":{"account":"Conta","profile":"Perfil","emails":"E-mails","notifications":"Notificações","categories":"Categorias","users":"Usuários","tags":"Etiquetas","interface":"Interface","apps":"Aplicativos"},"change_password":{"success":"(e-mail enviado)","in_progress":"(enviando e-mail)","error":"(erro)","action":"Enviar E-mail de Redefinição de Senha","set_password":"Definir Senha","choose_new":"Escolha uma nova senha","choose":"Escolha uma senha"},"second_factor_backup":{"title":"Códigos de Backup de Dois Fatores","regenerate":"Gerar Novamente","disable":"Desabilitar","enable":"Habilitar","enable_long":"Habilitar códigos de backup","manage":"Gerenciar códigos de backup. Você tem \u003cstrong\u003e{{count}}\u003c/strong\u003e códigos de backup restantes.","copied_to_clipboard":"Copiado para a Área de Transferência","copy_to_clipboard_error":"Erro ao copiar dados para a Área de Transferência","remaining_codes":"Você tem \u003cstrong\u003e{{count}}\u003c/strong\u003e códigos de backup restantes.","use":"Use um código de backup","enable_prerequisites":"Você deve habilitar um segundo fator primário antes de gerar códigos de backup.","codes":{"title":"Códigos de Backup Gerados","description":"Cada um destes códigos de backup só pode ser usado uma vez. Mantenha-os em algum lugar seguro, mas acessível."}},"second_factor":{"title":"Autenticação de Dois Fatores","enable":"Gerenciar Autenticação de Dois Fatores","forgot_password":"Esqueceu a senha?","confirm_password_description":"Por favor, confirme sua senha para continuar","name":"Nome","label":"Código","rate_limit":"Por favor, aguarde antes de tentar outro código de autenticação.","enable_description":"Digitalize este código QR em um aplicativo compatível (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e - \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) e digite seu código de autenticação.\n","disable_description":"Por favor, insira o código de autenticação do seu aplicativo","show_key_description":"Inserir manualmente","short_description":"Proteja sua conta com códigos de segurança de uso único.\n","extended_description":"A autenticação de dois fatores adiciona segurança extra à sua conta, exigindo um token único além da sua senha. Tokens podem ser gerados em dispositivos \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e e \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e.\n","oauth_enabled_warning":"Por favor, observe que os logins sociais serão desabilitados quando a autenticação de dois fatores for habilitada na sua conta.","use":"Use o Aplicativo Autenticador","enforced_notice":"Você precisa ativar a autenticação de dois fatores antes de acessar este site.","disable":"Desabilitar","disable_title":"Desabilitar Segundo Fator","disable_confirm":"Tem certeza que você quer desabilitar todos os segundos fatores?","edit":"Editar","edit_title":"Editar Segundo Fator","edit_description":"Nome do Segundo Fator","enable_security_key_description":"Quando você tiver sua chave de segurança física preparada, pressione o botão Registrar abaixo.","totp":{"title":"Autenticadores Baseados em Token","add":"Novo Autenticador","default_name":"Meu Autenticador","name_and_code_required_error":"Você deve fornecer um nome e o código do seu aplicativo de autenticação."},"security_key":{"register":"Registro","title":"Chaves de Segurança","add":"Registrar Chave de Segurança","default_name":"Chave de Segurança Principal","not_allowed_error":"O processo de registro da chave de segurança atingiu o tempo limite ou foi cancelado.","already_added_error":"Você já registrou esta chave de segurança.\nVocê não tem que registrá-la novamente.","edit":"Editar Chave de Segurança","edit_description":"Nome da Chave de Segurança","delete":"Excluir","name_required_error":"Você deve fornecer um nome para sua chave de segurança."}},"change_about":{"title":"Modificar Sobre Mim","error":"Houve um erro ao alterar este valor."},"change_username":{"title":"Alterar Nome de Usuário","confirm":"Você tem certeza absoluta de que deseja alterar seu nome de usuário?","taken":"Desculpe, este nome de usuário já está sendo usado.","invalid":"Este nome de usuário é inválido. Ele deve conter apenas números e letras"},"change_email":{"title":"Alterar E-mail","taken":"Desculpe, este e-mail não está disponível.","error":"Houve um erro ao alterar seu e-mail. Talvez aquele endereço já esteja sendo usado?","success":"Enviamos um e-mail para aquele endereço. Por favor, siga as instruções de confirmação.","success_staff":"Enviamos um e-mail para o seu endereço atual. Por favor, siga as instruções de confirmação."},"change_avatar":{"title":"Alterar sua imagem de perfil","letter_based":"Imagem de perfil atribuída pelo sistema","uploaded_avatar":"Imagem personalizada","uploaded_avatar_empty":"Adicionar uma imagem personalizada","upload_title":"Enviar sua imagem","image_is_not_a_square":"Aviso: nós cortamos a sua imagem; largura e altura não eram iguais."},"change_profile_background":{"title":"Cabeçalho do Perfil","instructions":"Os cabeçalhos do perfil serão centralizados e terão uma largura padrão de 1110px."},"change_card_background":{"title":"Plano de Fundo do Cartão de Usuário","instructions":"Imagens de plano de fundo serão centralizadas e terão uma largura padrão de 590px."},"change_featured_topic":{"title":"Tópico em Destaque","instructions":"Um link para este tópico estará no seu cartão de usuário e no seu perfil."},"email":{"title":"E-mail","primary":"E-mail Primário","secondary":"E-mails Secundários","no_secondary":"Nenhum e-mail secundário","sso_override_instructions":"E-mail pode ser atualizado do provedor de SSO.","instructions":"Nunca visível publicamente.","ok":"Nós enviaremos um e-mail para confirmar","invalid":"Por favor, insira um endereço de e-mail válido","authenticated":"Seu e-mail foi autenticado por {{provider}}","frequency_immediately":"Enviaremos um e-mail imediatamente se você não tiver lido a coisa sobre a qual estamos enviando o e-mail.","frequency":{"one":"Só lhe enviaremos um e-mail se não o tivermos visto no último minuto.","other":"Só lhe enviaremos um e-mail se não o tivermos visto nos últimos {{count}} minutos."}},"associated_accounts":{"title":"Contas Associadas","connect":"Conectar","revoke":"Revogar","cancel":"Cancelar","not_connected":"(não conectado)","confirm_modal_title":"Conecte-se à conta %{provider}","confirm_description":{"account_specific":"Sua conta %{provider} '%{account_description}' será usada para autenticação.","generic":"Sua conta %{provider} será usada para autenticação."}},"name":{"title":"Nome","instructions":"seu nome completo (opcional)","instructions_required":"Seu nome completo","too_short":"Seu nome é muito curto","ok":"Seu nome parece bom"},"username":{"title":"Nome de Usuário","instructions":"único, sem espaços, curto","short_instructions":"Pessoas podem mencionar você usando @{{username}}.","available":"Seu nome de usuário está disponível","not_available":"Não está disponível. Tente {{suggestion}}?","not_available_no_suggestion":"Não disponível","too_short":"Seu nome de usuário é muito curto","too_long":"Seu nome de usuário é muito longo","checking":"Verificando disponibilidade do nome de usuário...","prefilled":"E-mail corresponde a este nome de usuário cadastrado"},"locale":{"title":"Idioma da interface","instructions":"Idioma da interface do usuário. Será alterado quando você atualizar a página.","default":"(padrão)","any":"qualquer"},"password_confirmation":{"title":"Senha Novamente"},"invite_code":{"title":"Código de convite"},"auth_tokens":{"title":"Dispositivos Usados Recentemente","ip":"IP","details":"Detalhes","log_out_all":"Sair de todos","active":"ativo agora","not_you":"Não é você?","show_all":"Mostrar todos ({{count}})","show_few":"Mostrar menos","was_this_you":"Foi você?","was_this_you_description":"Se não foi você, recomendamos que você altere sua senha e saia de todos os dispositivos.","browser_and_device":"{{browser}} em {{device}}","secure_account":"Proteger minha Conta","latest_post":"Você postou por último…"},"last_posted":"Última Postagem","last_emailed":"Último E-mail Enviado","last_seen":"Visto","created":"Registrou","log_out":"Sair","location":"Localização","website":"Web Site","email_settings":"E-mail","hide_profile_and_presence":"Ocultar meu perfil público e recursos de presença","enable_physical_keyboard":"Habilitar suporte para teclado físico no iPad","text_size":{"title":"Tamanho do Texto","smaller":"Menor","normal":"Normal","larger":"Grande","largest":"Maior"},"title_count_mode":{"title":"O plano de fundo do título da página exibe a contagem de:","notifications":"Novas notificações","contextual":"Novo conteúdo da página"},"like_notification_frequency":{"title":"Notificar ao ser curtido","always":"Sempre","first_time_and_daily":"Primeira vez que uma postagem é curtida e diariamente","first_time":"Primeira vez que uma postagem é curtida","never":"Nunca"},"email_previous_replies":{"title":"Incluir respostas anteriores no final dos e-mails","unless_emailed":"exceto os enviados anteriormente","always":"sempre","never":"nunca"},"email_digests":{"title":"Quando eu não visitar aqui, envie-me um resumo por e-mail de tópicos e respostas populares","every_30_minutes":"a cada 30 minutos","every_hour":"a cada hora","daily":"diariamente","weekly":"semanalmente","every_month":"a cada mês","every_six_months":"a cada seis meses"},"email_level":{"title":"Envie-me um e-mail quando alguém me citar, responder ao meu post, mencionar meu @username ou me convidar para um tópico","always":"sempre","only_when_away":"somente quando estiver longe","never":"nunca"},"email_messages_level":"Envie-me um e-mail quando alguém me enviar uma mensagem","include_tl0_in_digests":"Incluir conteúdo de usuários novos nos e-mails de resumo","email_in_reply_to":"Incluir um trecho das respostas à postagem nos e-mails","other_settings":"Outras","categories_settings":"Categorias","new_topic_duration":{"label":"Considerar tópicos como novos quando","not_viewed":"Eu ainda não os vi","last_here":"criados desde a última vez em que estive aqui","after_1_day":"criados no último dia","after_2_days":"criados nos últimos 2 dias","after_1_week":"criados na última semana","after_2_weeks":"criados nas últimas 2 semanas"},"auto_track_topics":"Automaticamente acompanhar tópicos que eu entrar","auto_track_options":{"never":"nunca","immediately":"imediatamente","after_30_seconds":"depois de 30 segundos","after_1_minute":"depois de 1 minuto","after_2_minutes":"depois de 2 minutos","after_3_minutes":"depois de 3 minutos","after_4_minutes":"depois de 4 minutos","after_5_minutes":"depois de 5 minutos","after_10_minutes":"depois de 10 minutos"},"notification_level_when_replying":"Quando eu postar em um tópico, definir aquele tópico como","invited":{"search":"digite para pesquisar convites...","title":"Convites","user":"Usuário Convidado","sent":"Último envio","none":"Não há convites para exibir.","truncated":{"one":"Mostrando o primeiro convite.","other":"Mostrando os primeiros {{count}} convites."},"redeemed":"Convites Usados","redeemed_tab":"Usados","redeemed_tab_with_count":"Usados ({{count}})","redeemed_at":"Usado","pending":"Convites Pendentes","pending_tab":"Pendentes","pending_tab_with_count":"Pendentes ({{count}})","topics_entered":"Tópicos Visualizados","posts_read_count":"Postagens Lidas","expired":"Este convite expirou.","rescind":"Remover","rescinded":"Convite removido","rescind_all":"Remover todos os Convites Expirados","rescinded_all":"Todos os Convites Expirados removidos!","rescind_all_confirm":"Você tem certeza de que deseja remover todos os convites expirados?","reinvite":"Reenviar Convite","reinvite_all":"Reenviar todos os Convites","reinvite_all_confirm":"Você tem certeza de que deseja reenviar todos os convites?","reinvited":"Convite reenviado","reinvited_all":"Todos os Convites foram reenviados!","time_read":"Tempo de Leitura","days_visited":"Dias Visitados","account_age_days":"Idade da conta em dias","create":"Enviar um Convite","generate_link":"Copiar Link do Convite","link_generated":"Link do convite gerado com sucesso!","valid_for":"Link do convite é válido apenas para este endereço de e-mail: %{email}","bulk_invite":{"none":"Você ainda não convidou ninguém para cá. Envie convites individuais, ou convide várias pessoas de uma só vez, fazendo a \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eimportação de um arquivo CSV\u003c/a\u003e.","text":"Convidar em Massa a partir de Arquivo","success":"Arquivo enviado com sucesso, você será notificado por mensagem quando o processo estiver completo.","error":"Desculpe, o arquivo deve estar no formato CSV.","confirmation_message":"Você está prestes a enviar convites por e-mail para todos no arquivo enviado."}},"password":{"title":"Senha","too_short":"A sua senha é muito curta.","common":"Aquela senha é muito comum.","same_as_username":"A sua senha é a mesma que o seu nome de usuário.","same_as_email":"A sua senha é a mesma que o seu e-mail.","ok":"A sua senha parece boa.","instructions":"pelo menos %{count} caracteres"},"summary":{"title":"Resumo","stats":"Estatísticas","time_read":"tempo de leitura","recent_time_read":"tempo de leitura recente","topic_count":{"one":"tópico criado","other":"tópicos criados"},"post_count":{"one":"postagem criada","other":"postagens criadas"},"likes_given":{"one":"dado","other":"dados"},"likes_received":{"one":"recebido","other":"recebidos"},"days_visited":{"one":"dia visitado","other":"dias visitados"},"topics_entered":{"one":"tópico visualizado","other":"tópicos visualizados"},"posts_read":{"one":"postagem lida","other":"postagens lidas"},"bookmark_count":{"one":"favorito","other":"favoritos"},"top_replies":"Melhores Respostas","no_replies":"Nenhuma resposta ainda.","more_replies":"Mais Respostas","top_topics":"Melhores Tópicos","no_topics":"Nenhum tópico ainda.","more_topics":"Mais Tópicos","top_badges":"Melhores Emblemas","no_badges":"Nenhum emblema ainda.","more_badges":"Mais Emblemas","top_links":"Melhores Links","no_links":"Nenhum link ainda.","most_liked_by":"Mais Curtido Por","most_liked_users":"Mais Curtidos","most_replied_to_users":"Mais Respondidos","no_likes":"Ainda sem nenhuma curtida.","top_categories":"Melhores Categorias","topics":"Tópicos","replies":"Respostas"},"ip_address":{"title":"Último Endereço IP"},"registration_ip_address":{"title":"Endereço IP de Registro"},"avatar":{"title":"Imagem de Perfil","header_title":"perfil, mensagens, favoritos e preferências"},"title":{"title":"Título","none":"(nenhum)"},"primary_group":{"title":"Grupo Primário","none":"(nenhum)"},"filters":{"all":"Todos"},"stream":{"posted_by":"Postado por","sent_by":"Enviado por","private_message":"mensagem","the_topic":"o tópico"}},"loading":"Carregando...","errors":{"prev_page":"ao tentar carregar","reasons":{"network":"Erro de Rede","server":"Erro de Servidor","forbidden":"Acesso Negado","unknown":"Erro","not_found":"Página Não Encontrada"},"desc":{"network":"Por favor, verifique sua conexão.","network_fixed":"Parece que voltou.","server":"Código do erro: {{status}}","forbidden":"Você não tem permissão para ver isto.","not_found":"Oops, a aplicação tentou carregar uma URL que não existe.","unknown":"Algo deu errado."},"buttons":{"back":"Voltar","again":"Tentar Novamente","fixed":"Carregar Página"}},"modal":{"close":"fechar"},"close":"Fechar","assets_changed_confirm":"Este site acabou de ser atualizado. Atualizar a página agora para ver a última versão?","logout":"Você foi desconectado.","refresh":"Atualizar","read_only_mode":{"enabled":"Este site está em modo de somente leitura. Por favor, continue a navegar, mas respostas, curtidas e outras ações estão desabilitadas por enquanto.","login_disabled":"O login é desabilitado enquanto o site está em modo de somente leitura.","logout_disabled":"O logout é desabilitado enquanto o site está em modo de somente leitura."},"logs_error_rate_notice":{},"learn_more":"saber mais...","all_time":"total","all_time_desc":"total de tópicos criados","year":"ano","year_desc":"tópicos criados nos últimos 365 dias","month":"mês","month_desc":"tópicos criados nos últimos 30 dias","week":"semana","week_desc":"tópicos criados nos últimos 7 dias","day":"dia","first_post":"Primeira postagem","mute":"Silenciar","unmute":"Remover Silêncio","last_post":"Postado","time_read":"Lido","time_read_recently":"%{time_read} recentemente","time_read_tooltip":"%{time_read} tempo total lido","time_read_recently_tooltip":"%{time_read} tempo total lido (%{recent_time_read} nos últimos 60 dias)","last_reply_lowercase":"última resposta","replies_lowercase":{"one":"resposta","other":"respostas"},"signup_cta":{"sign_up":"Cadastrar-se","hide_session":"Me lembrar amanhã","hide_forever":"não obrigado","hidden_for_session":"OK, eu vou te perguntar amanhã. Você sempre pode usar o 'Entrar' também para criar uma conta.","intro":"Tudo bom? Parece que você está gostando da discussão, mas ainda não se cadastrou para uma conta.","value_prop":"Quando você cria uma conta, lembramos exatamente o que você leu, para que você volte sempre de onde parou. Você também recebe notificações, aqui e via e-mail, sempre que alguém responder a você. E você pode gostar de postagens para compartilhar o amor. :heartpulse:"},"summary":{"enabled_description":"Você está vendo um resumo deste tópico: as postagens mais interessantes conforme determinados pela comunidade.","description":"Existem \u003cb\u003e{{replyCount}}\u003c/b\u003e respostas.","description_time":"Existem \u003cb\u003e{{replyCount}}\u003c/b\u003e respostas com tempo de leitura estimado de \u003cb\u003e{{readingTime}} minutos\u003c/b\u003e.","enable":"Resumir Este Tópico","disable":"Exibir Todas as Postagens"},"deleted_filter":{"enabled_description":"Este tópico contém postagens excluídas, que foram ocultadas.","disabled_description":"As postagens excluídas neste tópico estão sendo mostrados.","enable":"Ocultar Postagens Excluídas","disable":"Mostrar Postagens Excluídas"},"private_message_info":{"title":"Mensagem","invite":"Convidar Outros ...","edit":"Adicionar ou Remover ...","leave_message":"Você quer mesmo sair desta mensagem?","remove_allowed_user":"Você quer mesmo remover {{name}} desta mensagem?","remove_allowed_group":"Você quer mesmo remover {{name}} desta mensagem?"},"email":"E-mail","username":"Nome de Usuário","last_seen":"Visto","created":"Criado","created_lowercase":"criado","trust_level":"Nível de Confiança","search_hint":"nome de usuário, e-mail ou endereço IP","create_account":{"disclaimer":"Ao se registrar, você concorda com a \u003ca href='{{privacy_link}}' target='blank'\u003epolítica de privacidade\u003c/a\u003e e os \u003ca href='{{tos_link}}' target='blank'\u003etermos de serviço\u003c/a\u003e.","title":"Criar Nova Conta","failed":"Algo deu errado, talvez este e-mail já esteja cadastrado, tente usar o link de esqueci a senha."},"forgot_password":{"title":"Redefinição de Senha","action":"Eu esqueci a minha senha","invite":"Insira o seu nome de usuário ou endereço de e-mail, e nós lhe enviaremos um e-mail para redefinir a sua senha.","reset":"Redefinir Senha","complete_username":"Se uma conta corresponder ao nome de usuário \u003cb\u003e%{username}\u003c/b\u003e, você deverá receber um e-mail com instruções de como redefinir sua senha rapidamente.","complete_email":"Se uma conta corresponder à \u003cb\u003e%{email}\u003c/b\u003e, você deverá receber um e-mail com instruções de como redefinir sua senha rapidamente.","complete_username_not_found":"Nenhuma conta corresponde ao nome de usuário \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nenhuma conta corresponde à \u003cb\u003e%{email}\u003c/b\u003e","help":"E-mail não está chegando? Certifique-se de verificar sua pasta de spam primeiro.\u003cp\u003eNão tem certeza de qual endereço de e-mail você usou? Digite um endereço de e-mail e informaremos se ele existe aqui.\u003c/p\u003e\u003cp\u003eSe você não tiver mais acesso ao endereço de e-mail da sua conta, entre em contato com \u003ca href='%{basePath}/about'\u003enossa prestativa staff.\u003c/a\u003e\u003c/p\u003e","button_ok":"OK","button_help":"Ajuda"},"email_login":{"link_label":"Envie-me um link de login","button_label":"com e-mail","complete_username":"Se uma conta corresponder ao nome de usuário \u003cb\u003e%{username}\u003c/b\u003e, você deverá receber um e-mail com um link de login em breve.","complete_email":"Se uma conta corresponder à \u003cb\u003e%{email}\u003c/b\u003e, você deverá receber um e-mail com um link de login em breve.","complete_username_found":"Encontramos uma conta que corresponde ao nome de usuário \u003cb\u003e%{username}\u003c/b\u003e, você deverá receber um e-mail com um link de login em breve.","complete_email_found":"Encontramos uma conta que corresponde à \u003cb\u003e%{email}\u003c/b\u003e, você deverá receber um e-mail com um link de login em breve.","complete_username_not_found":"Nenhuma conta corresponde ao nome de usuário \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nenhuma conta corresponde à \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Continuar no %{site_name}","logging_in_as":"Fazendo login como %{email}","confirm_button":"Terminar Login"},"login":{"title":"Entrar","username":"Usuário","password":"Senha","second_factor_title":"Autenticação de Dois Fatores","second_factor_description":"Por favor, digite o código de autenticação do seu aplicativo:","second_factor_backup":"Efetuar log in usando um código de backup","second_factor_backup_title":"Backup de Dois Fatores","second_factor_backup_description":"Por favor, insira um dos seus códigos de backup:","second_factor":"Efetuar log in usando um Aplicativo de Autenticação.","security_key_description":"Quando você tiver uma chave física de segurança preparada, pressione o Anti\n\nQuando sua chave de segurança física estiver pronta, pressione o botão \"Autenticar com Chave de Segurança\" abaixo.","security_key_alternative":"Tente outra maneira","security_key_authenticate":"Autenticar com Chave de Segurança","security_key_not_allowed_error":"O processo de autenticação de chave de segurança atingiu o limite de tempo ou foi cancelado.","security_key_no_matching_credential_error":"Nenhuma credencial correspondente pôde ser encontrada na chave de segurança fornecida.","security_key_support_missing_error":"Seu dispositivo atual ou navegador não suportam o uso de chaves de segurança. Por favor, use um método diferente.","email_placeholder":"e-mail ou nome de usuário","caps_lock_warning":"Caps Lock está ativado","error":"Erro desconhecido","cookies_error":"Seu navegador parece ter cookies desativados. Você pode não conseguir efetuar login sem ativá-los primeiro.","rate_limit":"Por favor, aguarde antes de tentar entrar novamente.","blank_username":"Por favor, insira seu e-mail ou nome de usuário.","blank_username_or_password":"Por favor, insira seu e-mail ou nome de usuário, e senha.","reset_password":"Redefinir Senha","logging_in":"Entrando...","or":"Ou","authenticating":"Autenticando...","awaiting_activation":"Sua conta está aguardando ativação, utilize o link de esqueci a senha para enviar um novo e-mail de ativação.","awaiting_approval":"Sua conta ainda não foi aprovada por um membro da staff. Você receberá um e-mail quando sua conta for aprovada.","requires_invite":"Desculpe, o acesso a este fórum é permitido somente por convite de outro membro.","not_activated":"Você não pode entrar ainda. Nós lhe enviamos um e-mail de ativação anteriormente para endereço \u003cb\u003e{{sentTo}}\u003c/b\u003e. Por favor, siga as instruções contidas neste e-mail para ativar a sua conta.","not_allowed_from_ip_address":"Você não pode entrar com este endereço IP.","admin_not_allowed_from_ip_address":"Você não pode entrar como administrador com este endereço IP.","resend_activation_email":"Clique aqui para enviar o e-mail de ativação novamente.","omniauth_disallow_totp":"Sua conta tem autenticação dois fatores ativada. Por favor, entre com sua senha.","resend_title":"Reenviar E-mail de Ativação","change_email":"Alterar Endereço de E-mail","provide_new_email":"Forneça um novo endereço de e-mail e nós re-enviaremos seu e-mail de confirmação.","submit_new_email":"Atualizar Endereço de E-mail","sent_activation_email_again":"Nós enviamos mais um e-mail de ativação para você no endereço \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Pode ser que demore alguns minutos para chegar; verifique sempre sua caixa de spam.","sent_activation_email_again_generic":"Nós enviamos mais um e-mail de ativação. Pode ser que demore alguns minutos para chegar; tenha certeza de verificar sua caixa de spam.","to_continue":"Por Favor, Entre","preferences":"Você precisa estar logado para mudar suas preferências de usuário.","forgot":"Não me recordo dos detalhes da minha conta","not_approved":"Sua conta ainda não foi aprovada. Você será notificado por e-mail quando tudo estiver pronto para você entrar.","google_oauth2":{"name":"Google","title":"com Google"},"twitter":{"name":"Twitter","title":"com Twitter"},"instagram":{"name":"Instagram","title":"com Instagram"},"facebook":{"name":"Facebook","title":"com Facebook"},"github":{"name":"GitHub","title":"com GitHub"},"discord":{"name":"Discord","title":"com Discórdia"},"second_factor_toggle":{"totp":"Use um aplicativo autenticador","backup_code":"Use um código de backup"}},"invites":{"accept_title":"Convite","welcome_to":"Bem vindo à %{site_name}!","invited_by":"Você foi convidado por:","social_login_available":"Você também poderá entrar com qualquer login social usando este e-mail.","your_email":"O endereço de e-mail da sua conta é \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Aceitar Convite","success":"Sua conta foi criada e você já está logado.","name_label":"Nome","password_label":"Definir Senha","optional_description":"(opcional)"},"password_reset":{"continue":"Continuar para %{site_name}"},"emoji_set":{"apple_international":"Apple/Internacional","google":"Google","twitter":"Twitter","emoji_one":"JoyPixels (anteriormente EmojiOne)","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Categorias Apenas","categories_with_featured_topics":"Categorias com Tópicos em Destaque","categories_and_latest_topics":"Categorias e Últimos Tópicos","categories_and_top_topics":"Categorias e Melhores Tópicos","categories_boxes":"Caixas com Subcategorias","categories_boxes_with_topics":"Caixas com Tópicos em Destaque"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"Inserir"},"conditional_loading_section":{"loading":"Carregando..."},"category_row":{"topic_count":"{{count}} tópicos nesta categoria"},"select_kit":{"default_header_text":"Selecionar...","no_content":"Nenhuma correspondência encontrada","filter_placeholder":"Pesquisar...","filter_placeholder_with_any":"Pesquisar ou criar…","create":"Criar: '{{content}}'","max_content_reached":{"one":"Você só pode selecionar {{count}} item.","other":"Você só pode selecionar {{count}} itens."},"min_content_not_reached":{"one":"Selecione pelo menos {{count}} item.","other":"Selecione pelo menos {{count}} itens."}},"date_time_picker":{"from":"De","to":"Para","errors":{"to_before_from":"Até a data deve ser posterior a partir da data."}},"emoji_picker":{"filter_placeholder":"Pesquisar por emoji","smileys_\u0026_emotion":"Smileys e Emotion","people_\u0026_body":"Pessoas e Corpo","animals_\u0026_nature":"Animais e Natureza","food_\u0026_drink":"Comida e Bebida","travel_\u0026_places":"Viagens e Lugares","activities":"Atividades","objects":"Objetos","symbols":"Símbolos","flags":"Sinalizações","recent":"Usados recentemente","default_tone":"Sem tom de pele","light_tone":"Tom de pele claro","medium_light_tone":"Tom de pele médio claro","medium_tone":"Tom de pele médio","medium_dark_tone":"Tom de pele médio escuro","dark_tone":"Tom de pele escuro","default":"Emojis personalizados"},"shared_drafts":{"title":"Rascunhos Compartilhados","notice":"Este tópico só é visível para aqueles que podem ver a categoria \u003cb\u003e{{category}}\u003c/b\u003e.","destination_category":"Categoria de Destino","publish":"Publicar Rascunho Compartilhado","confirm_publish":"Você tem certeza de que deseja publicar este rascunho?","publishing":"Publicando Tópico..."},"composer":{"emoji":"Emoji :)","more_emoji":"mais...","options":"Opções","whisper":"sussuro","unlist":"não listado","blockquote_text":"Bloco de Citação","add_warning":"Esta é uma advertência oficial.","toggle_whisper":"Alternar Sussuro","toggle_unlisted":"Alternar Não Listado","posting_not_on_topic":"Qual tópico você gostaria de responder?","saved_local_draft_tip":"salvo localmente","similar_topics":"Seu tópico é parecido com...","drafts_offline":"rascunhos offline","edit_conflict":"editar conflito","group_mentioned_limit":"\u003cb\u003eAviso!\u003c/b\u003e Você mencionou \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e; no entanto, este grupo tem mais membros do que o limite de menção configurado pelo administrador de {{max}} usuários. Ninguém será notificado.","group_mentioned":{"one":"Ao mencionar {{group}}, você está prestes a notificar \u003ca href='{{group_link}}'\u003e%{count} pessoa\u003c/a\u003e – você tem certeza?","other":"Ao mencionar {{group}}, você está prestes a notificar \u003ca href='{{group_link}}'\u003e{{count}} pessoas\u003c/a\u003e – você tem certeza?"},"cannot_see_mention":{"category":"Você mencionou {{username}}, mas ele(a) não será notificado(a), pois ele(a) não tem acesso à esta categoria. Você precisará adicioná-lo(a) ao grupo que tem acesso à categoria.","private":"Você mencionou {{username}}, mas ele(a) não será notificado(a), pois ele(a) não pode ver esta mensagem pessoal. Você precisará convidá-lo(a) para esta MP."},"duplicate_link":"Parece que o seu link para \u003cb\u003e{{domain}}\u003c/b\u003e já foi postado neste tópico por \u003cb\u003e@{{username}}\u003c/b\u003e em \u003ca href='{{post_url}}'\u003euma resposta em {{ago}}\u003c/a\u003e – você tem certeza de que deseja postá-lo novamente?","reference_topic_title":"RE: {{title}}","error":{"title_missing":"Título é obrigatório","title_too_short":"Título precisa ter no mínimo {{min}} caracteres","title_too_long":"Título não pode ter mais de {{max}} caracteres","post_missing":"A postagem não pode estar vazia","post_length":"Postagem precisa ter no mínimo {{min}} caracteres","try_like":"Você já tentou o botão {{heart}}?","category_missing":"Você precisa escolher uma categoria","tags_missing":"Você precisa escolher pelo menos {{count}} etiquetas","topic_template_not_modified":"Por favor, adicione detalhes e especificações ao seu tópico editando o modelo do tópico."},"save_edit":"Salvar Edição","overwrite_edit":"Sobrescrever Edição","reply_original":"Responder no Tópico Original","reply_here":"Responder Aqui","reply":"Responder","cancel":"Cancelar","create_topic":"Criar Tópico","create_pm":"Criar Mensagem","create_whisper":"Criar Sussurro","create_shared_draft":"Criar Rascunho Compartilhado","edit_shared_draft":"Editar Rascunho Compartilhado","title":"Ou pressione Ctrl+Enter","users_placeholder":"Adicionar um usuário","title_placeholder":"Sobre o que é esta discussão em uma breve frase?","title_or_link_placeholder":"Digite um título, ou cole um link aqui","edit_reason_placeholder":"por que você está editando?","topic_featured_link_placeholder":"Inserir link mostrado no título.","remove_featured_link":"Remover link do tópico.","reply_placeholder":"Digite aqui. Use Markdown, BBCode, ou HTML para formatar. Arraste ou cole imagens.","reply_placeholder_no_images":"Digite aqui. Use Markdown, BBCode, ou HTML para formatar.","reply_placeholder_choose_category":"Selecione uma categoria antes de digitar aqui.","view_new_post":"Veja a sua nova postagem.","saving":"Salvando","saved":"Salvo!","uploading":"Enviando...","show_preview":"mostrar pré-visualização \u0026raquo;","hide_preview":"\u0026laquo; ocultar pré-visualização","quote_post_title":"Citar postagem inteira","bold_label":"N","bold_title":"Negrito","bold_text":"texto em negrito","italic_label":"I","italic_title":"Itálico","italic_text":"texto em itálico","link_title":"Hyperlink","link_description":"digite a descrição do link aqui","link_dialog_title":"Inserir Hyperlink","link_optional_text":"título opcional","link_url_placeholder":"Cole uma URL ou digite para pesquisar tópicos","quote_title":"Bloco de Citação","quote_text":"Bloco de Citação","code_title":"Texto pré-formatado","code_text":"identar texto pré-formatado por 4 espaços","paste_code_text":"digite ou cole o código aqui","upload_title":"Enviar","upload_description":"digite aqui a descrição do arquivo enviado","olist_title":"Lista Numerada","ulist_title":"Lista com Marcadores","list_item":"Item da lista","toggle_direction":"Alternar Direção","help":"Ajuda de Edição Markdown","collapse":"minimizar o painel compositor","open":"abrir o painel compositor","abandon":"fechar compositor e descartar rascunho","enter_fullscreen":"entrar no compositor em tela cheia","exit_fullscreen":"sair do compositor em tela cheia","modal_ok":"OK","modal_cancel":"Cancelar","cant_send_pm":"Desculpe, você não pode enviar uma mensagem para %{username}.","yourself_confirm":{"title":"Você se esqueceu de adicionar destinatários?","body":"No momento esta mensagem está sendo enviada apenas para você mesmo!"},"admin_options_title":"Configurações opcionais da staff para este tópico","composer_actions":{"reply":"Responder","draft":"Rascunho","edit":"Editar","reply_to_post":{"label":"Responder à postagem %{postNumber} por %{postUsername}","desc":"Responder à uma postagem específica"},"reply_as_new_topic":{"label":"Responder como tópico relacionado","desc":"Criar um novo tópico relacionado a este tópico"},"reply_as_private_message":{"label":"Nova mensagem","desc":"Criar uma nova mensagem pessoal"},"reply_to_topic":{"label":"Responder ao tópico","desc":"Responder ao tópico, não à uma postagem específica"},"toggle_whisper":{"label":"Alternar sussurro","desc":"Sussurros são visíveis apenas para membros da staff"},"create_topic":{"label":"Novo Tópico"},"shared_draft":{"label":"Rascunho Compartilhado","desc":"Elabore um tópico que será visível somente para a staff"},"toggle_topic_bump":{"label":"Alternar promoção de tópico","desc":"Responder sem alterar a data da última resposta"}},"details_title":"Resumo","details_text":"Este texto ficará oculto."},"notifications":{"tooltip":{"regular":{"one":"%{count} notificação não visualizada","other":"{{count}} notificações não visualizadas"},"message":{"one":"%{count} mensagem não lida","other":"{{count}} mensagens não lidas"}},"title":"notificações de menção de @nome, respostas às suas postagens, tópicos, mensagens, etc","none":"Não foi possível carregar notificações no momento.","empty":"Nenhuma notificação foi encontrada.","post_approved":"Sua postagem foi aprovada","reviewable_items":"itens que exigem revisão","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} e %{count} outro\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} e {{count}} outros\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"curtiu {{count}} de suas postagens","other":"curtiu {{count}} de suas postagens"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e aceitou o seu convite","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e moveu {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Ganhou '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNovo Tópico\u003c/span\u003e {{description}}","membership_request_accepted":"Afiliação aceita em '{{group_name}}'","membership_request_consolidated":"{{count}} abre solicitações de associação para '{{group_name}}'","group_message_summary":{"one":"{{count}} mensagem na caixa de entrada de {{group_name}}","other":"{{count}} mensagens na caixa de entrada de {{group_name}}"},"popup":{"mentioned":"{{username}} mencionou você em \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} mencionou você em \"{{topic}}\" - {{site_title}}","quoted":"{{username}} citou você em \"{{topic}}\" - {{site_title}}","replied":"{{username}} te respondeu em \"{{topic}}\" - {{site_title}}","posted":"{{username}} postou em \"{{topic}}\" - {{site_title}}","private_message":"{{username}} te enviou uma mensagem pessoal em \"{{topic}}\" - {{site_title}}","linked":"{{username}} referenciou a sua postagem em \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} criou um novo tópico \"{{topic}}\" - {{site_title}}","confirm_title":"Notificações habilitadas - %{site_title}","confirm_body":"Sucesso! Notificações foram habilitadas.","custom":"Notificação de {{username}} em %{site_title}"},"titles":{"mentioned":"mencionado","replied":"nova resposta","quoted":"citado","edited":"editado","liked":"nova curtida","private_message":"nova mensagem privada","invited_to_private_message":"convidado para mensagem privada","invitee_accepted":"convite aceito","posted":"nova postagem","moved_post":"postagem movida","linked":"conectado","granted_badge":"emblema concedido","invited_to_topic":"convidado para o tópico","group_mentioned":"grupo mencionado","group_message_summary":"novas mensagens de grupo","watching_first_post":"novo tópico","topic_reminder":"lembrete de tópico","liked_consolidated":"novas curtidas","post_approved":"publicação aprovada","membership_request_consolidated":"novas solicitações de associação"}},"upload_selector":{"title":"Adicionar uma imagem","title_with_attachments":"Adicionar uma imagem ou um arquivo","from_my_computer":"Do meu dispositivo","from_the_web":"Da Internet","remote_tip":"link para imagem","remote_tip_with_attachments":"link para imagem ou arquivo {{authorized_extensions}}","local_tip":"selecione imagens a partir do seu dispositivo","local_tip_with_attachments":"selecione imagens ou arquivos do seu dispositivo {{authorized_extensions}}","hint":"(você também pode arrastar e soltar no editor para enviá-las)","hint_for_supported_browsers":"você também pode arrastar e soltar no editor para enviá-las","uploading":"Enviando","select_file":"Selecionar Arquivo","default_image_alt_text":"imagem"},"search":{"sort_by":"Ordenar por","relevance":"Relevância","latest_post":"Última Postagem","latest_topic":"Último Tópico","most_viewed":"Mais Visto","most_liked":"Mais Curtido","select_all":"Selecionar Todos","clear_all":"Limpar Todos","too_short":"Seu termo de pesquisa é muito curto.","result_count":{"one":"\u003cspan\u003e%{count} resultado para\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} resultados para\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"pesquisar tópicos, postagens, usuários, ou categorias","full_page_title":"pesquisar tópicos ou postagens","no_results":"Nenhum resultado encontrado.","no_more_results":"Nenhum outro resultado encontrado.","searching":"Pesquisando...","post_format":"#{{post_number}} por {{username}}","results_page":"Pesquisar resultados para '{{term}}'","more_results":"Existem mais resultados. Por favor, restrinja os seus critérios de pesquisa.","cant_find":"Não consegue encontrar o que você está procurando?","start_new_topic":"Que tal começar um novo tópico?","or_search_google":"Ou tente pesquisar com o Google:","search_google":"Tente pesquisar com o Google em vez disso:","search_google_button":"Google","search_google_title":"Pesquisar este site","context":{"user":"Pesquisar postagens por @{{username}}","category":"Pesquisar a categoria #{{category}}","tag":"Pesquisar a #{{tag}} etiqueta","topic":"Pesquisar este tópico","private_messages":"Pesquisar mensagens"},"advanced":{"title":"Pesquisa Avançada","posted_by":{"label":"Postado por"},"in_category":{"label":"Categorizado"},"in_group":{"label":"Em Grupo"},"with_badge":{"label":"Com Emblema"},"with_tags":{"label":"Etiquetado"},"filters":{"label":"Retornar somente tópicos/postagens...","title":"Correspondência somente no título","likes":"Eu curti","posted":"Eu postei em","created":"Eu criei","watching":"Eu estou observando","tracking":"Eu estou acompanhando","private":"Nas minhas mensagens","bookmarks":"Eu marquei como favorito","first":"são exatamente a primeira postagem","pinned":"estão fixados","unpinned":"não estão fixados","seen":"Eu li","unseen":"Eu não li","wiki":"são wiki","images":"incluem imagem(ns)","all_tags":"Todas as etiquetas acima"},"statuses":{"label":"Onde tópicos","open":"estão abertos","closed":"estão fechados","public":"são públicos","archived":"estão arquivados","noreplies":"não possuem respostas","single_user":"contém um único usuário"},"post":{"count":{"label":"Contagem de Postagem Mínima"},"time":{"label":"Postado","before":"antes","after":"depois"}}}},"hamburger_menu":"ir para outra listagem de tópicos ou categoria","new_item":"novo","go_back":"voltar","not_logged_in_user":"página do usuário com resumo de atividades e preferências atuais","current_user":"ir para a sua página de usuário","view_all":"ver tudo","topics":{"new_messages_marker":"última visita","bulk":{"select_all":"Selecionar Tudo","clear_all":"Limpar Tudo","unlist_topics":"Desalistar Tópicos","relist_topics":"Realistar Tópicos","reset_read":"Redefinir Lido","delete":"Excluir Tópicos","dismiss":"Descartar","dismiss_read":"Descartar todos os não lidos","dismiss_button":"Descartar...","dismiss_tooltip":"Descartar apenas postagens novas ou parar de acompanhar tópicos","also_dismiss_topics":"Parar de acompanhar estes tópicos para que eles deixem de aparecer como não lidos para mim","dismiss_new":"Descartar Novos","toggle":"alternar seleção em massa de tópicos","actions":"Ações em Massa","change_category":"Definir Categoria","close_topics":"Fechar Tópicos","archive_topics":"Arquivar Tópicos","notification_level":"Notificações","choose_new_category":"Escolha a nova categoria para os tópicos:","selected":{"one":"Você selecionou \u003cb\u003e%{count}\u003c/b\u003e tópico.","other":"Você selecionou \u003cb\u003e{{count}}\u003c/b\u003e tópicos."},"change_tags":"Substituir Etiquetas","append_tags":"Adicionar Etiquetas","choose_new_tags":"Escolha novas etiquetas para estes tópicos:","choose_append_tags":"Escolha novas etiquetas para adicionar a estes tópicos:","changed_tags":"As etiquetas para estes tópicos foram alteradas."},"none":{"unread":"Você não tem tópicos não lidos.","new":"Você não tem novos tópicos.","read":"Você ainda não leu nenhum tópico.","posted":"Você ainda não postou em nenhum tópico.","latest":"Não há últimos tópicos. Isto é triste.","bookmarks":"Você ainda não tem nenhum tópico favorito.","category":"Não há tópicos na categoria {{category}}.","top":"Não há melhores tópicos.","educate":{"new":"\u003cp\u003eSeus novos tópicos aparecem aqui.\u003c/p\u003e\u003cp\u003ePor padrão, tópicos são considerados novos e mostrarão um indicador de \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enovo\u003c/span\u003e se eles foram criados nos últimos 2 dias.\u003c/p\u003e\u003cp\u003eVisite as suas \u003ca href=\"%{userPrefsUrl}\"\u003epreferências\u003c/a\u003e para alterar isto.\u003c/p\u003e","unread":"\u003cp\u003eSeus tópicos não lidos aparecem aqui.\u003c/p\u003e\u003cp\u003ePor padrão, tópicos são considerados como não lidos e irão mostrar contadores \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e se você:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCriou o tópico\u003c/li\u003e\u003cli\u003eRespondeu ao tópico\u003c/li\u003e\u003cli\u003eLeu o tópico por mais de 4 minutos\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOu se você explicitamente colocou o tópico como Monitorado ou Observado através do controle de notificações na parte inferior de cada tópico.\u003c/p\u003e\u003cp\u003eVisite suas \u003ca href=\"%{userPrefsUrl}\"\u003epreferências\u003c/a\u003e para alterar isto.\u003c/p\u003e"}},"bottom":{"latest":"Não há mais últimos tópicos.","posted":"Não há mais tópicos postados.","read":"Não há mais tópicos lidos.","new":"Não há mais tópicos novos.","unread":"Não há mais tópicos não lidos.","category":"Não há mais tópicos na categoria {{category}}.","top":"Não há mais melhores tópicos.","bookmarks":"Não há mais tópicos favoritos."}},"topic":{"filter_to":{"one":"%{count} postagem no tópico","other":"{{count}} postagens no tópico"},"create":"Novo Tópico","create_long":"Criar um novo Tópico","open_draft":"Rascunho Aberto","private_message":"Iniciar uma mensagem","archive_message":{"help":"Mover mensagem para o seu arquivo","title":"Arquivar"},"move_to_inbox":{"title":"Mover para Caixa de Entrada","help":"Mover mensagem de volta para Caixa de Entrada"},"edit_message":{"help":"Editar primeira postagem da mensagem","title":"Editar Mensagem"},"defer":{"help":"Marcar como não lido","title":"Delegar"},"feature_on_profile":{"help":"Adicionar um link para este tópico em seu cartão de usuário e perfil","title":"Recurso no Perfil"},"remove_from_profile":{"warning":"Seu perfil já tem um tópico em destaque. Se você continuar, este tópico substituirá o tópico existente.","help":"Remover o link para este tópico no seu perfil de usuário","title":"Remover do Perfil"},"list":"Tópicos","new":"novo tópico","unread":"não lido","new_topics":{"one":"%{count} tópico novo","other":"{{count}} tópicos novos"},"unread_topics":{"one":"%{count} tópico não lido","other":"{{count}} tópicos não lidos"},"title":"Tópico","invalid_access":{"title":"Tópico é privado","description":"Desculpe, você não tem acesso àquele tópico!","login_required":"Você precisa entrar para ver aquele tópico."},"server_error":{"title":"Falha ao carregar o tópico","description":"Desculpe, nós não conseguimos carregar este tópico, possivelmente devido a um problema na conexão. Por favor tente novamente. Se o problema persistir, entre em contato conosco."},"not_found":{"title":"Tópico não encontrado","description":"Desculpe, não foi possível encontrar aquele tópico. Talvez ele tenha sido removido por um moderador?"},"total_unread_posts":{"one":"você tem %{count} postagem não lida neste tópico","other":"você tem {{count}} postagens não lidas neste tópico"},"unread_posts":{"one":"você tem %{count} postagem antiga não lida neste tópico","other":"você tem {{count}} postagens antigas não lidas neste tópico"},"new_posts":{"one":"há %{count} postagem nova neste tópico desde a sua última leitura","other":"há {{count}} postagens novas neste tópico desde a sua última leitura"},"likes":{"one":"há %{count} curtida neste tópico","other":"há {{count}} curtidas neste tópico"},"back_to_list":"Voltar para a Lista de Tópicos","options":"Opções de Tópico","show_links":"mostrar links dentro deste tópico","toggle_information":"alternar detalhes do tópico","read_more_in_category":"Quer ler mais? Veja outros tópicos em {{catLink}} ou {{latestLink}}.","read_more":"Quer ler mais? {{catLink}} ou {{latestLink}}.","group_request":"Você precisa solicitar filiação ao grupo `{{name}}` para ver este tópico","group_join":"Você precisa juntar-se ao grupo `{{name}}` para ver este tópico","group_request_sent":"Sua solicitação de filiação ao grupo foi enviada. Você será informado(a) quando ela for aceita.","unread_indicator":"Nenhum membro leu a última postagem deste tópico ainda.","browse_all_categories":"Ver todas as categorias","view_latest_topics":"ver últimos tópicos","suggest_create_topic":"Por que não criar um tópico?","jump_reply_up":"pular para a primeira resposta","jump_reply_down":"pular para a última resposta","deleted":"Este tópico foi excluído","topic_status_update":{"title":"Temporizador de Tópico","save":"Definir Temporizador","num_of_hours":"Número de horas:","remove":"Remover Temporizador","publish_to":"Publicar Em:","when":"Quando:","public_timer_types":"Temporizadores de Tópico","private_timer_types":"Temporizadores de Tópico do Usuário","time_frame_required":"Por favor selecione um período de tempo"},"auto_update_input":{"none":"Selecione um período de tempo","later_today":"Mais tarde hoje","tomorrow":"Amanhã","later_this_week":"Mais tarde nesta semana","this_weekend":"Este fim de semana","next_week":"Próxima semana","two_weeks":"Duas Semanas","next_month":"Próximo mês","two_months":"Dois Meses","three_months":"Três Meses","four_months":"Quatro Meses","six_months":"Seis Meses","one_year":"Um Ano","forever":"Para Sempre","pick_date_and_time":"Escolha data e hora","set_based_on_last_post":"Fechar baseado na última postagem"},"publish_to_category":{"title":"Agendar Publicação"},"temp_open":{"title":"Abrir Temporariamente"},"auto_reopen":{"title":"Abrir Tópico Automaticamente"},"temp_close":{"title":"Fechar Temporariamente"},"auto_close":{"title":"Fechar Tópico Automaticamente","label":"Horas para fechar tópico automaticamente:","error":"Por favor insira um valor válido.","based_on_last_post":"Não fechar até que a última postagem do tópico tenha pelo menos esta idade."},"auto_delete":{"title":"Excluir Tópico Automaticamente"},"auto_bump":{"title":"Promover Tópico Automaticamente"},"reminder":{"title":"Lembrar-me"},"status_update_notice":{"auto_open":"Este tópico abrirá automaticamente em %{timeLeft}.","auto_close":"Este tópico fechará automaticamente em %{timeLeft}.","auto_publish_to_category":"Este tópico será publicado em \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_close_based_on_last_post":"Este tópico fechará %{duration} após a última resposta.","auto_delete":"Este tópico será automaticamente excluído %{timeLeft}.","auto_bump":"Este tópico será automaticamente promovido %{timeLeft}.","auto_reminder":"Você será lembrado sobre este tópico %{timeLeft}."},"auto_close_title":"Configurações de Fechamento Automático","auto_close_immediate":{"one":"A última postagem no tópico já foi feita há %{count} hora, portanto o tópico será fechado imediatamente.","other":"A última postagem no tópico já foi feita há %{count} horas, portanto o tópico será fechado imediatamente."},"timeline":{"back":"Voltar","back_description":"Voltar para a sua última postagem não lida","replies_short":"%{current} / %{total}"},"progress":{"title":"progresso do tópico","go_top":"topo","go_bottom":"último","go":"ir","jump_bottom":"pular para a última postagem","jump_prompt":"pular para...","jump_prompt_of":"de %{count} postagens","jump_prompt_long":"Pular para...","jump_bottom_with_number":"pular para postagem %{post_number}","jump_prompt_to_date":"até agora","jump_prompt_or":"ou","total":"total de mensagens","current":"resposta atual"},"notifications":{"title":"altere a frequência de notificações deste tópico","reasons":{"mailing_list_mode":"Você está com o modo de lista de discussão ativado, portanto será notificado sobre as respostas deste tópico por e-mail.","3_10":"Você receberá notificações porque está acompanhando uma etiqueta neste tópico.","3_6":"Você receberá notificações porque você está observando esta categoria.","3_5":"Você receberá notificações porque começou a observar este tópico automaticamente.","3_2":"Você receberá notificações porque está observando este tópico.","3_1":"Você receberá notificações porque criou este tópico.","3":"Você receberá notificações porque você está observando este tópico.","2_8":"Você verá uma contagem de novas respostas porque está acompanhando esta categoria.","2_4":"Você verá uma contagem de novas respostas porque postou uma resposta a este tópico.","2_2":"Você verá uma contagem de novas respostas porque está acompanhando este tópico.","2":"Você verá uma contagem de novas respostas porque você \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eleu este tópico\u003c/a\u003e.","1_2":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem.","1":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem.","0_7":"Você está ignorando todas as notificações nesta categoria.","0_2":"Você está ignorando todas as notificações deste tópico.","0":"Você está ignorando todas as notificações deste tópico."},"watching_pm":{"title":"Observando","description":"Você será notificado de cada mensagem nova neste tópico. Um contador de mensagens novas e não lidas também aparecerá próximo ao tópico."},"watching":{"title":"Observar","description":"Você será notificado de cada mensagem nova neste tópico. Um contador de mensagens novas e não lidas também aparecerá próximo ao tópico."},"tracking_pm":{"title":"Monitorando","description":"Um contador de novas respostas será mostrado para esta mensagem. Você será notificado se alguém mencionar seu @nome ou responder à sua mensagem."},"tracking":{"title":"Monitorar","description":"Um contador de novas respostas será mostrado para este tópico. Você será notificado se alguém mencionar seu @nome ou responder à sua mensagem."},"regular":{"title":"Normal","description":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem."},"regular_pm":{"title":"Normal","description":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem."},"muted_pm":{"title":"Silenciado","description":"Você nunca será notificado de qualquer coisa sobre esta mensagem privada."},"muted":{"title":"Silenciar","description":"Você nunca será notificado sobre este tópico e ele não aparecerá nos tópicos recentes."}},"actions":{"title":"Ações","recover":"Recuperar Tópico","delete":"Apagar tópico","open":"Abrir tópico","close":"Fechar tópico","multi_select":"Selecionar Mensagens...","timed_update":"Definir o temporizador do tópico ...","pin":"Fixar Tópico...","unpin":"Desafixar Tópico...","unarchive":"Desarquivar tópico","archive":"Arquivar tópico","invisible":"Tornar Invisível","visible":"Tornar Visível","reset_read":"Repor data de leitura","make_public":"Transformar em Tópico Público","make_private":"Faça uma mensagem pessoal","reset_bump_date":"Resetar Data de Promoção"},"feature":{"pin":"Fixar Tópico","unpin":"Desafixar Tópico","pin_globally":"Fixar Tópico Globalmente","make_banner":"Banner Tópico","remove_banner":"Remover Banner Tópico"},"reply":{"title":"Responder","help":"começar a escrever uma resposta para este tópico"},"clear_pin":{"title":"Remover destaque","help":"Retirar destaque deste tópico para que ele não apareça mais no topo da sua lista de tópicos"},"share":{"title":"Compartilhar","extended_title":"Compartilhar um link","help":"compartilhar um link deste tópico"},"print":{"title":"Imprimir","help":"Abrir uma versão imprimível deste tópico"},"flag_topic":{"title":"Sinalizar","help":"sinaliza privativamente este tópico para chamar atenção ou notificar privativamente sobre isto","success_message":"Você sinalizou com sucesso este tópico."},"make_public":{"title":"Converter para o tópico público","choose_category":"Por favor, escolha uma categoria para o tópico público:"},"feature_topic":{"title":"Destacar este tópico","pin":"Fazer que este tópico apareça no topo da categoria {{categoryLink}} até","confirm_pin":"Você já tem {{count}} tópicos fixos. Muitos tópicos fixados podem atrapalhar usuários novos e anônimos. Tem certeza que quer fixar outro tópico nesta categoria?","unpin":"Remover este tópico do inicio da {{categoryLink}} categoria.","unpin_until":"Remover este tópico do topo da categoria {{categoryLink}} ou esperar até \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Usuários podem desafixar o tópico individualmente para si.","pin_validation":"Uma data é necessária para fixar este tópico.","not_pinned":"Não existem tópicos fixados em {{categoryLink}}.","already_pinned":{"one":"Tópicos fixados em {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Tópicos fixados em {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Fazer com que este tópico apareça no topo de todas listas de tópicos até","confirm_pin_globally":"Você já tem {{count}} tópicos fixados globalmente. Muitos tópicos fixados podem prejudicar usuários novos e anônimos. Tem certeza que quer fixar outro tópico globalmente?","unpin_globally":"Remover este tópico do inicio de todas as listas de tópicos.","unpin_globally_until":"Remover este tópico do topo de todas listagens de tópicos ou esperar até \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Usuários podem desafixar o tópico individualmente para si.","not_pinned_globally":"Não existem tópicos fixados globalmente.","already_pinned_globally":{"one":"Tópicos atualmente fixados globalmente: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e.","other":"Tópicos atualmente fixados globalmente: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Tornar este tópico em um banner que apareça no inicio de todas as páginas.","remove_banner":"Remover o banner que aparece no inicio de todas as páginas.","banner_note":"Usuários podem dispensar o banner fechando-o. Apenas um tópico pode ser colocado como banner a cada momento.","no_banner_exists":"Não existe tópico banner.","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003eExiste\u003c/strong\u003e atualmente um tópico banner."},"inviting":"Convidando...","automatically_add_to_groups":"Este convite também inclui acesso para esses grupos:","invite_private":{"title":"Convidar para Conversa Privada","email_or_username":"E-mail ou Nome de Usuário do Convidado","email_or_username_placeholder":"e-mail ou Nome de Usuário","action":"Convite","success":"Nós convidamos aquele usuário para participar desta mensagem privada.","success_group":"Nós convidamos aquele grupo para participar desta mensagem.","error":"Desculpe, houve um erro ao convidar este usuário.","group_name":"nome do grupo"},"controls":"Controles do Tópico","invite_reply":{"title":"Convite","username_placeholder":"nome de usuário","action":"Enviar Convite","help":"Convidar outros para este tópico por e-mail ou notificação","to_forum":"Nós vamos mandar um e-mail curto permitindo seu amigo a entrar e responder a este tópico clicando em um link, sem necessidade de entrar.","sso_enabled":"Entrar o nome de usuário da pessoa que você gostaria de convidar para este tópico.","to_topic_blank":"Entrar o nome de usuário ou endereço de e-mail da pessoa que você gostaria de convidar para este tópico.","to_topic_email":"Você digitou um endereço de e-mail. Nós enviaremos um convite por e-mail que permite seu amigo responder imediatamente a este tópico.","to_topic_username":"Você inseriu um nome de usuário. Nós vamos enviar uma notificação com um link convidando-o para este tópico.","to_username":"Insira o nome de usuário da pessoa que você gostaria de convidas. Nós vamos enviar uma notificação com um link convidando-o para este tópico.","email_placeholder":"nome@exemplo.com","success_email":"Enviamos um convite para \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Nós notificaremos você quando este convite for resgatado. Verifique a aba de convites na página de seu usuário para acompanhar seus convites.","success_username":"Nós convidamos o usuário para participar neste tópico.","error":"Desculpe, nós não pudemos convidar esta pessoa. Talvez já seja usuário? (convites têm taxa limitada)","success_existing_email":"Um usuário com e-mail \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e já existe. Convidamos este usuário a participar deste tópico."},"login_reply":"Logar para Responder","filters":{"n_posts":{"one":"%{count} mensagem","other":"{{count}} mensagens"},"cancel":"Remover filtro"},"move_to":{"title":"Mover para","action":"mover para","error":"Houve um erro ao mover postagens."},"split_topic":{"title":"Mover para novo tópico","action":"mover para novo tópico","topic_name":"Título do Novo Tópico","radio_label":"Novo Tópico","error":"Houve um erro ao mover as mensagens para o novo tópico.","instructions":{"one":"Você está prestes a criar um novo tópico e populá-lo com a resposta que você selecionou.","other":"Você está prestes a criar um novo tópico e populá-lo com as \u003cb\u003e{{count}}\u003c/b\u003e respostas que você selecionou."}},"merge_topic":{"title":"Mover para tópico já existente","action":"mover para tópico já existente","error":"Houve um erro ao mover as mensagens para aquele tópico.","radio_label":"Tópico Existente","instructions":{"one":"Por favor selecione o tópico para o qual você gostaria de mover esta resposta.","other":"Por favor selecione o tópico para o qual você gostaria de mover estas \u003cb\u003e{{count}}\u003c/b\u003e respostas."}},"move_to_new_message":{"title":"Mover para Nova Mensagem","action":"mover para nova mensagem","message_title":"Título da Nova Mensagem","radio_label":"Nova Mensagem","participants":"Participantes","instructions":{"one":"Você está prestes a criar uma nova mensagem e preenchê-la com a postagem que você selecionou.","other":"Você está prestes a criar uma nova mensagem e preenchê-la com as \u003cb\u003e{{count}}\u003c/b\u003epostagens que você selecionou."}},"move_to_existing_message":{"title":"Mover para Mensagem Existente","action":"mover para mensagem existente","radio_label":"Mensagem Existente","participants":"Participantes","instructions":{"one":"Por favor escolha a mensagem para a qual você gostaria de mover aquela postagem.","other":"Por favor escolha a mensagem para a qual você gostaria de mover aquelas \u003cb\u003e{{count}}\u003c/b\u003e postagens."}},"merge_posts":{"title":"Unificar as Mensagens Selecionadas","action":"unificar as mensagens selecionadas","error":"Houve um erro ao unificar as mensagens selecionadas."},"change_owner":{"title":"Trocar Autor","action":"trocar autor","error":"Houve um erro ao alterar o autor destas mensagens.","placeholder":"novo autor","instructions":{"one":"Por favor escolha um novo autor para a postagem de \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Por favor escolha um novo autor para as {{count}} postagens de \u003cb\u003e@{{old_user}}\u003c/b\u003e"}},"change_timestamp":{"title":"Alterar o timestamp ...","action":"alterar horário","invalid_timestamp":"Horário não pode ser no futuro.","error":"Ocorreu um erro alterando o horário do tópico.","instructions":"Por favor selecione um novo horário para o tópico. Mensagens no tópico serão atualizadas para manter a mesma diferença de tempo."},"multi_select":{"select":"selecionar","selected":"({{count}}) selecionados","select_post":{"label":"selecione","title":"Adicionar postagem à seleção"},"selected_post":{"label":"selecionado","title":"Clique para remover a postagem da seleção"},"select_replies":{"label":"selecionar + respostas","title":"Adicionar post e todas as suas respostas à seleção"},"select_below":{"label":"selecione + abaixo","title":"Adicionar post e tudo depois dele para seleção"},"delete":"apagar selecionados","cancel":"cancelar seleção","select_all":"selecionar tudo","deselect_all":"deselecionar tudo","description":{"one":"\u003cb\u003e%{count}\u003c/b\u003e resposta selecionada.","other":"\u003cb\u003e{{count}}\u003c/b\u003e respostas selecionadas."}},"deleted_by_author":{"one":"(tópico retirado pelo autor, será automaticamente excluído em %{count} hora a menos que seja sinalizado)","other":"(tópico retirado pelo autor, será automaticamente excluído em %{count} horas a menos que seja sinalizado)"}},"post":{"quote_reply":"Citação","edit_reason":"Motivo:","post_number":"resposta {{number}}","ignored":"Conteúdo ignorado","wiki_last_edited_on":"wiki última vez editada em","last_edited_on":"resposta editada pela última vez em","reply_as_new_topic":"Responder como um Tópico linkado","reply_as_new_private_message":"Responder como nova mensagem aos mesmos destinatários","continue_discussion":"Continuando a discussão do {{postLink}}:","follow_quote":"ir para a resposta citada","show_full":"Exibir mensagem completa","show_hidden":"Ver o conteúdo ignorado.","deleted_by_author":{"one":"(respostas abandonadas pelo autor, serão removidas automaticamente em %{count} hora a exceto se forem sinalizadas)","other":"(respostas abandonadas pelo autor, serão removidas automaticamente em %{count} horas a exceto se forem sinalizadas)"},"collapse":"colapso","expand_collapse":"expandir/encolher","locked":"um membro da equipe bloqueou este post de ser editado","gap":{"one":"ver %{count} resposta oculta","other":"ver {{count}} respostas ocultas"},"notice":{"new_user":"Esta é a primeira vez que o {{user}} postou — Vamos dar boas vindas da nossa comunidade","returning_user":"Já faz um tempo desde que vimos {{user}} — Seu ultimo poste foi {{time}}."},"unread":"Resposta não lida","has_replies":{"one":"{{count}} Resposta","other":"{{count}} Respostas"},"has_likes_title":{"one":"{{count}} pessoa curtiu esta mensagem","other":"{{count}} pessoas curtiram esta mensagem"},"has_likes_title_only_you":"você curtiu esta postagem","has_likes_title_you":{"one":"você e mais %{count} pessoa gostaram desta postagem","other":"você e mais {{count}} outras pessoas gostaram desta postagem"},"errors":{"create":"Desculpe, houve um erro ao criar sua resposta. Por favor, tente outra vez.","edit":"Desculpe, houve um erro ao editar sua resposta. Por favor, tente outra vez.","upload":"Desculpe, houve um erro ao enviar este arquivo. Por favor, tente outra vez.","file_too_large":"Desculpe, este arquivo é muito grande (o tamanho máximo é {{max_size_kb}}kb). Por que não faz o upload de seu arquivo grande em um serviço de nuvem e compartilha o link?","too_many_uploads":"Desculpe, você pode enviar apenas um arquivos por vez.","too_many_dragged_and_dropped_files":"Desculpe, você só pode enviar {{max}} arquivos de uma vez.","upload_not_authorized":"Desculpe, o arquivo que você está tentando enviar não é permitido (extensões permitidas: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Desculpe, novos usuário não podem enviar imagens.","attachment_upload_not_allowed_for_new_user":"Desculpe, usuários novos não podem enviar anexos.","attachment_download_requires_login":"Desculpe, você precisa estar logado para baixar arquivos anexos."},"abandon_edit":{"confirm":"Você tem certeza que deseja descartar suas alterações?","no_value":"Não, manter.","no_save_draft":"Não, salvar rascunho","yes_value":"Sim, descartar edição"},"abandon":{"confirm":"Tem certeza que quer abandonar a sua mensagem?","no_value":"Não, manter","no_save_draft":"Não, salvar rascunho","yes_value":"Sim, abandone"},"via_email":"post recebido via e-mail","via_auto_generated_email":"esta mensagem chegou através de um e-mail gerado automaticamente","whisper":"esta mensagem é um sussuro privado para moderadores","wiki":{"about":"esta postagem é uma wiki"},"archetypes":{"save":"Salvar as opções"},"few_likes_left":"Obrigado por compartilhar o amor! Restam apenas algumas poucas curtidas sobrando para você usar hoje.","controls":{"reply":"começar a escrever uma resposta para esta postagem","like":"curtir esta resposta","has_liked":"você curtiu esta resposta","read_indicator":"membros que leram esta postagem","undo_like":"desfazer curtida","edit":"editar esta resposta","edit_action":"Editar","edit_anonymous":"Você precisa estar conectado para editar esta resposta.","flag":"sinalizar em privado para chamar atenção a esta resposta ou enviar uma notificação privada sobre ela","delete":"apagar esta resposta","undelete":"recuperar esta resposta","share":"compartilhar o link desta resposta","more":"Mais","delete_replies":{"confirm":"Você também deseja excluir as respostas desta postagem?","direct_replies":{"one":"Sim e %{count} resposta direta","other":"Sim e {{count}} respostas diretas"},"all_replies":{"one":"Sim e %{count} resposta","other":"Sim, e todas as {{count}} respostas"},"just_the_post":"Não, apenas este post"},"admin":"ações administrativas da postagem","wiki":"Tornar Wiki","unwiki":"Remover Wiki","convert_to_moderator":"Converter para Moderação","revert_to_regular":"Remover da Moderação","rebake":"Reconstruir HTML","unhide":"Revelar","change_owner":"Trocar Autor","grant_badge":"Conceder Emblema","lock_post":"Bloquear Post","lock_post_description":"impedir que o autor edite esta postagem","unlock_post":"Desbloquear postagem","unlock_post_description":"permitir que o autor edite esta postagem","delete_topic_disallowed_modal":"Você não tem permissão para apagar este tópico. Se você realmente quiser que ele seja excluído, envie um sinalizador para a atenção do moderador juntamente com o raciocínio.","delete_topic_disallowed":"você não tem permissão para apagar este tópico","delete_topic":"apagar tópico","add_post_notice":"Adicionar Aviso da Staff","remove_post_notice":"Remover Aviso da Staff","remove_timer":"remover contador"},"actions":{"flag":"Sinalização","defer_flags":{"one":"Ignorar sinalizações","other":"Ignorar sinalizações"},"undo":{"off_topic":"Desfazer sinalização","spam":"Desfazer sinalização","inappropriate":"Desfazer sinalização","bookmark":"Remover favorito","like":"Descurtir"},"people":{"off_topic":"marcado como off-topic","spam":"marcado como spam","inappropriate":"marcado como inapropriado","notify_moderators":"notificaram os moderadores","notify_user":"enviou uma mensagem","bookmark":"favoritaram isto","like":{"one":"gostou disto","other":"gostaram disto"},"read":{"one":"leu isto","other":"Leram isto"},"like_capped":{"one":"e {{count}} outro gostou disto","other":"e {{count}} outros gostaram disto"},"read_capped":{"one":"e {{count}} outra leu isto","other":"e {{count}} outras leram isto"}},"by_you":{"off_topic":"Você sinalizou isto como off-topic","spam":"Você sinalizou isto como spam","inappropriate":"Você sinalizou isto como inapropriado","notify_moderators":"Você sinalizou isto para a moderação","notify_user":"Você enviou uma mensagem particular para este usuário","bookmark":"Você favoritou esta resposta","like":"Você curtiu"}},"delete":{"confirm":{"one":"Tem certeza de que deseja excluir esta postagem?","other":"Tem certeza de que deseja excluir as postagens de {{count}}?"}},"merge":{"confirm":{"one":"Tem certeza de que deseja mesclar estas postagens?","other":"Tem certeza de que deseja mesclar estas postagens de {{count}}?"}},"revisions":{"controls":{"first":"Primeira revisão","previous":"Revisão anterior","next":"Próxima revisão","last":"Última revisão","hide":"Esconder revisão","show":"Exibir revisão","revert":"Reverter para esta revisão","edit_wiki":"Editar Wiki","edit_post":"Editar Postagem","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Exibir a saída renderizada com adições e remoções em linha","button":"HTML"},"side_by_side":{"title":"Exibir as diferentes saídas renderizadas lado a lado","button":"HTML"},"side_by_side_markdown":{"title":"Mostrar a diferença da fonte crua lado-a-lado","button":"Texto Bruto"}}},"raw_email":{"displays":{"raw":{"title":"Mostrar Email","button":"Texto Bruto"},"text_part":{"title":"Mostrar texto do e-mail","button":"Texto"},"html_part":{"title":"Mostrar texto html do e-mail","button":"HTML"}}},"bookmarks":{"create":"Criar marcador","created":"Criado","name":"Nome"}},"category":{"can":"pode\u0026hellip; ","none":"(sem categoria)","all":"Todas as categorias","choose":"category\u0026hellip;","edit":"Editar","edit_dialog_title":"Editar: %{categoryName}","view":"Ver tópicos na categoria","general":"Geral","settings":"Configurações","topic_template":"Modelo de Tópico","tags":"Etiquetas","tags_allowed_tags":"Restringir estas etiquetas a esta categoria:","tags_allowed_tag_groups":"Restringir estes grupos de etiquetas a esta categoria:","tags_placeholder":"(Opcional) lista de etiquetas permitidas","tags_tab_description":"As etiquetas e grupos de etiquetas especificadas acima estarão disponíveis apenas nesta categoria e em outras categorias que também as especificarem. Elas não estarão disponíveis para uso em outras categorias.","tag_groups_placeholder":"(Opcional) lista de grupos de etiquetas permitidos","manage_tag_groups_link":"Gerencie grupos de etiquetas aqui.","allow_global_tags_label":"Permitir também outras etiquetas","tag_group_selector_placeholder":"(Opcional) Grupo de etiquetas","required_tag_group_description":"Exija que novos tópicos tenham etiquetas de um grupo de etiquetas:","min_tags_from_required_group_label":"Número de Etiquetas:","required_tag_group_label":"Grupo de etiquetas:","topic_featured_link_allowed":"Permitir links em destaque nesta categoria","delete":"Apagar categoria","create":"Nova categoria","create_long":"Criar uma nova categoria","save":"Salvar categoria","slug":"Slug da Categoria","slug_placeholder":"(Opcional) palavras hifenizadas para url","creation_error":"Houve um erro durante a criação da categoria.","save_error":"Houve um erro ao salvar a categoria.","name":"Nome da Categoria","description":"Descrição","topic":"tópico da categoria","logo":"Imagem do logo da categoria","background_image":"Imagem de fundo da categoria","badge_colors":"Cores do emblema","background_color":"Background color","foreground_color":"Foreground color","name_placeholder":"máximo de uma ou duas palavras","color_placeholder":"Qualquer cor web","delete_confirm":"Tem certeza que quer apagar esta categoria?","delete_error":"Houve um erro ao apagar a categoria.","list":"Lista de categorias","no_description":"Adicione uma descrição para esta categoria.","change_in_category_topic":"Editar Descrição","already_used":"Esta cor já foi usada para outra categoria","security":"Segurança","special_warning":"Atenção: Esta categoria é uma categoria padrão e as configurações de segurança e não podem ser editadas. Se você não quer usar esta categoria, apague-a ao invés de reaproveitá-la.","uncategorized_security_warning":"Esta categoria é especial. Ela é destinada para tópicos que não têm categoria; ela não pode ter configurações de segurança.","uncategorized_general_warning":"Esta categoria é especial. Ela é usada como a categoria padrão para novos tópicos que não possuem uma categoria selecionada. Se você quiser evitar este comportamento e forçar a seleção de categoria, \u003ca href=\"%{settingLink}\"\u003edesative a configuração aqui\u003c/a\u003e. Se você quiser alterar o nome ou a descrição, vá para \u003ca href=\"%{customizeLink}\"\u003ePersonalização / Conteúdo de Texto\u003c/a\u003e.","pending_permission_change_alert":"Você não adicionou %{group} a esta categoria; Clique neste botão para adicioná-los.","images":"Imagens","email_in":"Endereço de e-mail personalizado de entrada:","email_in_allow_strangers":"Aceitar e-mails de usuários anônimos sem cont","email_in_disabled":"Postar novos tópicos via e-mail está desabilitado nas Configurações do Site. Para habilitar respostas em novos tópicos via e-mail,","email_in_disabled_click":"habilitar a configuração de \"e-mail em\".","mailinglist_mirror":"Categoria espelha uma lista de discussão","show_subcategory_list":"Exibir lista de subcategorias acima dos tópicos nesta categoria.","num_featured_topics":"Número de tópicos exibidos na página de Categorias:","subcategory_num_featured_topics":"Número de tópicos em destaque na página da categoria pai:","all_topics_wiki":"Faça novos tópicos wikis por padrão","subcategory_list_style":"Estilo da lista de subcategorias","sort_order":"Classificar lista de tópicos:","default_view":"Lista padrão de tópicos","default_top_period":"Período Superior Padrão:","allow_badges_label":"Permitir a concessão de emblemas nesta categoria","edit_permissions":"Editar Permissões","reviewable_by_group":"Além da staff, postagens e sinalizações nesta categoria também podem ser revisadas por:","review_group_name":"nome do grupo","require_topic_approval":"Requer aprovação do moderador de todos os novos tópicos","require_reply_approval":"Requer aprovação do moderador de todas as novas respostas","this_year":"este ano","position":"Posição na página de categorias:","default_position":"Posição Padrão","position_disabled":"Categorias serão mostradas em ordem de atividade. Para controlar a ordem das categorias em listas,","position_disabled_click":"habilitar a configuração de \"posição de categoria fixa\".","minimum_required_tags":"Número mínimo de etiquetas requeridas em um tópico:","parent":"Categoria Principal","num_auto_bump_daily":"Número de tópicos em aberto para dar um bump diário automaticamente:","navigate_to_first_post_after_read":"Navegue até a primeira postagem depois que os tópicos forem lidos","notifications":{"watching":{"title":"Observar","description":"Você vai observar automaticamente todos os tópicos destas categorias. Você será notificado de todas as novas mensagens em todos os tópicos. Além disso, a contagem de novas respostas também será exibida."},"watching_first_post":{"title":"Observando o primeiro post","description":"Você será notificado sobre novos tópicos nesta categoria, mas não sobre respostas aos tópicos."},"tracking":{"title":"Monitorar","description":"Você vai acompanhar automaticamente todos os tópicos destas categorias. Você será notificado se alguém mencionar o seu @nome ou responder para você. Além disso, a contagem de novas respostas também será exibida."},"regular":{"title":"Normal","description":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem."},"muted":{"title":"Silenciar","description":"Você nunca será notificado sobre novos tópicos nestas categorias, e não aparecerão no Recentes."}},"search_priority":{"label":"Prioridade de Pesquisa","options":{"normal":"Normal","ignore":"Ignorar","very_low":"Muito Baixa","low":"Baixo","high":"Alta","very_high":"Muito Alta"}},"sort_options":{"default":"padrão","likes":"Curtidas","op_likes":"Curtidas da Publicação Original","views":"Visualizações","posts":"Postagens","activity":"Atividade","posters":"Autores","category":"Categoria","created":"Criado","votes":"Votos"},"sort_ascending":"Ascendente","sort_descending":"Descendente","subcategory_list_styles":{"rows":"Linhas","rows_with_featured_topics":"Linhas com Tópicos em destaque","boxes":"Caixas","boxes_with_featured_topics":"Caixas com tópicos em destaque"},"settings_sections":{"general":"Geral","moderation":"Moderação","appearance":"Aparência","email":"E-mail"}},"flagging":{"title":"Obrigado por ajudar a manter a civilidade da nossa comunidade!","action":"Sinalizar resposta","take_action":"Tomar Atitude","notify_action":"Mensagem","official_warning":"Aviso Oficial","delete_spammer":"Apagar Spammer","yes_delete_spammer":"Sim, Apagar Spammer","ip_address_missing":"(N/D)","hidden_email_address":"(escondido)","submit_tooltip":"Enviar uma sinalização privada","take_action_tooltip":"Atingir o limiar de denuncias imediatamente, ao invés de esperar para mais denuncias da comunidade","cant":"Desculpe, não é possível colocar uma sinalização neste momento.","notify_staff":"Avisar a equipe privadamente","formatted_name":{"off_topic":"É Off-Tópico","inappropriate":"É inapropriado","spam":"É spam"},"custom_placeholder_notify_user":"Seja específico, construtivo e sempre seja gentil.","custom_placeholder_notify_moderators":"Deixe-nos saber especificamente com o que você está preocupado, e nos forneça links relevantes e exemplos quando possível.","custom_message":{"at_least":{"one":"insira pelo menos %{count} caractere","other":"insira pelo menos {{count}} caracteres"},"more":{"one":"Falta apenas %{count}...","other":"Faltam {{count}}..."},"left":{"one":"%{count} restante","other":"{{count}} restantes"}}},"flagging_topic":{"title":"Obrigado por ajudar a manter a civilidade da nossa comunidade!","action":"Sinalizar Tópico","notify_action":"Mensagem"},"topic_map":{"title":"Resumo do Tópico","participants_title":"Autores Frequentes","links_title":"Links Populares","links_shown":"mostrar mais links...","clicks":{"one":"%{count} clique","other":"%{count} cliques"}},"post_links":{"about":"expandir mais links para esta mensagem","title":{"one":"mais %{count}","other":"mais %{count}"}},"topic_statuses":{"warning":{"help":"Este é um aviso oficial."},"bookmarked":{"help":"Você adicionou este tópico aos favoritos"},"locked":{"help":"Este tópico está fechado; não serão aceitas mais respostas"},"archived":{"help":"Este tópico está arquivado; está congelado e não pode ser alterado"},"locked_and_archived":{"help":"Este tópico está fechado e arquivado; ele não aceita novas respostas e não pode ser alterado."},"unpinned":{"title":"Não fixo","help":"Este tópico está desfixado para você; ele será mostrado em ordem normal"},"pinned_globally":{"title":"Fixo Globalmente","help":"Este tópico está fixado globalmente; ele será exibido no topo da aba Recentes e no topo da sua categoria"},"pinned":{"title":"Fixo","help":"Este tópico está fixado para você; ele será mostrado no topo de sua categoria"},"unlisted":{"help":"Este tópico não está listado; ele não será exibido em listas de tópicos e só pode ser acessado por meio de um link direto"},"personal_message":{"title":"Este tópico é uma mensagem pessoal","help":"Este tópico é uma mensagem pessoal"}},"posts":"Postagens","posts_long":"há {{number}} mensagens neste tópico","original_post":"Resposta original","views":"Visualizações","views_lowercase":{"one":"visualizar","other":"visualizações"},"replies":"Respostas","views_long":{"one":"este tópico foi visto uma vez","other":"este tópico foi visto {{number}} vezes"},"activity":"Atividade","likes":"Curtidas","likes_lowercase":{"one":"like","other":"likes"},"likes_long":"há {{number}} curtidas neste tópico","users":"Usuários","users_lowercase":{"one":"usuário","other":"usuários"},"category_title":"Categoria","history":"Histórico","changed_by":"por {{author}}","raw_email":{"title":"Detalhes dos Emails Recebidos","not_available":"Não disponível!"},"categories_list":"Lista de categorias","filters":{"with_topics":"%{filter} tópicos","with_category":"%{filter} %{category} tópicos","latest":{"title":"Recente","title_with_count":{"one":"Recente (%{count})","other":"Recentes ({{count}})"},"help":"tópicos com mensagens recentes"},"read":{"title":"Lido","help":"tópicos que você leu"},"categories":{"title":"Categorias","title_in":"Categoria - {{categoryName}}","help":"todos os tópicos agrupados por categoria"},"unread":{"title":"Não lidas","title_with_count":{"one":"Não lido (%{count})","other":"Não lidos ({{count}})"},"help":"tópicos que você está observando ou acompanhando com mensagens não lidas","lower_title_with_count":{"one":"%{count} não lido","other":"{{count}} não lidos"}},"new":{"lower_title_with_count":{"one":"%{count} nova","other":"{{count}} novas"},"lower_title":"nova","title":"Novo","title_with_count":{"one":"Novo (%{count})","other":"Novos ({{count}})"},"help":"tópicos criados nos últimos dias"},"posted":{"title":"Minhas mensagens","help":"tópicos nos quais você postou"},"bookmarks":{"title":"Favoritos","help":"tópicos que você adicionou aos favoritos"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"tópicos recentes na categoria {{categoryName}}"},"top":{"title":"Melhores","help":"os tópicos mais ativos no último ano, mês, semana ou dia","all":{"title":"Tempo Todo"},"yearly":{"title":"Anualmente"},"quarterly":{"title":"Trimestralmente"},"monthly":{"title":"Mensalmente"},"weekly":{"title":"Semanalmente"},"daily":{"title":"Diariamente"},"all_time":"Tempo Todo","this_year":"Ano","this_quarter":"Trimestre","this_month":"Mês","this_week":"Semana","today":"Hoje","other_periods":"Veja o topo"},"votes":{"title":"Votos","help":"tópicos com a maioria dos votos"}},"browser_update":"Infelizmente, \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003eo seu navegador é muito antigo para funcionar neste site\u003c/a\u003e. Por favor, \u003ca href=\"https://browsehappy.com\"\u003eatualize o seu navegador\u003c/a\u003e.","permission_types":{"full":"Criar / Responder / Ver","create_post":"Responder / Ver","readonly":"Ver"},"lightbox":{"download":"download","previous":"Anterior (tecla de seta para a esquerda)","next":"Próximo (tecla de seta para a direita)","counter":"%curr% de %total%","close":"Fechar (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eO conteúdo\u003c/a\u003e não pôde ser carregado.","image_load_error":"\u003ca href=\"%url%\"\u003eA imagem\u003c/a\u003e não pôde ser carregada."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":",","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} ou %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"Atalhos de teclado","jump_to":{"title":"Ir Para","home":"%{shortcut} Início","latest":"%{shortcut} Mais recentes","new":"%{shortcut} Novos","unread":"%{shortcut} Não Lidos","categories":"%{shortcut} Categorias","top":"%{shortcut} Topo","bookmarks":"%{shortcut} Favoritos","profile":"%{shortcut} Perfil","messages":"%{shortcut} Mensagens","drafts":"%{shortcut} Rascunhos"},"navigation":{"title":"Navegação","jump":"%{shortcut} Ir para a mensagem #","back":"%{shortcut} Voltar","up_down":"%{shortcut} Move seleção \u0026uarr; \u0026darr;","open":"%{shortcut} Abre tópico selecionado","next_prev":"%{shortcut} Pŕoxima seção/seção anterior","go_to_unread_post":"%{shortcut} Ir para a primeira postagem não lida"},"application":{"title":"Aplicação","create":"%{shortcut} Criar um tópico novo","notifications":"%{shortcut} Abre notificações","hamburger_menu":"%{shortcut} Abrir o menu hambúrguer","user_profile_menu":"%{shortcut} Abrir menu do usuário","show_incoming_updated_topics":"%{shortcut} Exibir tópicos atualizados","search":"%{shortcut} Procurar","help":"%{shortcut} Abrir ajuda de teclado","dismiss_new_posts":"%{shortcut} Descartar Novas Postagens","dismiss_topics":"%{shortcut} Descartar Tópicos","log_out":"%{shortcut} Deslogar"},"composing":{"title":"Composição","return":"%{shortcut} Retornar ao compositor","fullscreen":"%{shortcut} Compositor em tela cheia"},"actions":{"title":"Ações","bookmark_topic":"%{shortcut} Favoritar o tópico","pin_unpin_topic":"%{shortcut} Fixar/Desfixar tópico","share_topic":"%{shortcut} Compartilhar tópico","share_post":"%{shortcut} Compartilhar mensagem","reply_as_new_topic":"%{shortcut} Responder como tópico linkado","reply_topic":"%{shortcut} Responder ao tópico","reply_post":"%{shortcut} Responder a mensagem","quote_post":"%{shortcut} Citar resposta","like":"%{shortcut} Curtir a mensagem","flag":"%{shortcut} Sinalizar mensagem","bookmark":"%{shortcut} Favoritar mensagem","edit":"%{shortcut} Editar mensagem","delete":"%{shortcut} Excluir mensagem","mark_muted":"%{shortcut} Silenciar tópico","mark_regular":"%{shortcut} Tópico regular (padrão)","mark_tracking":"%{shortcut} Monitorar o tópico","mark_watching":"%{shortcut} Observar o tópico","print":"%{shortcut} Imprimir tópico","defer":"%{shortcut} Adiar tópico","topic_admin_actions":"%{shortcut} Abrir ações de administração de tópicos"}},"badges":{"earned_n_times":{"one":"Emblema adquirido %{count} vez","other":"Emblema adquirido %{count} vezes"},"granted_on":"Concedido em %{date}","others_count":"Outros com este emblema (%{count})","title":"Emblemas","allow_title":"Você pode usar este selo como um título","multiple_grant":"Você pode ganhar isto várias vezes","badge_count":{"one":"%{count} Emblema","other":"%{count} Emblemas"},"more_badges":{"one":"+%{count} Mais","other":"+%{count} Mais"},"granted":{"one":"%{count} concedido","other":"%{count} concedidos"},"select_badge_for_title":"Selecione um emblema para usar como o seu título","none":"(nenhum)","successfully_granted":"Concedido com sucesso %{badge} to %{username}","badge_grouping":{"getting_started":{"name":"Primeiros Passos"},"community":{"name":"Comunidade"},"trust_level":{"name":"Nível de Confiança"},"other":{"name":"Outros"},"posting":{"name":"Publicando"}}},"tagging":{"all_tags":"Todas as Etiquetas","other_tags":"Outras etiquetas","selector_all_tags":"todas as etiquetas","selector_no_tags":"sem etiquetas","changed":"etiquetas alteradas:","tags":"Etiquetas","choose_for_topic":"etiquetas opcionais","info":"Informações","default_info":"Esta etiqueta não está restrita a nenhuma categorias e não possui sinônimos.","synonyms":"Sinônimos","synonyms_description":"Quando as seguintes etiquetas forem usadas, eles serão substituídas por \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"Esta etiqueta pertence a este grupo: {{tag_groups}}.","other":"Esta etiqueta pertence a estes grupos: {{tag_groups}}."},"category_restrictions":{"one":"Pode ser usada nesta categoria:","other":"Pode ser usada nestas categorias:"},"edit_synonyms":"Gerenciar sinônimos","add_synonyms_label":"Adicionar sinônimos:","add_synonyms":"Adicionar","add_synonyms_failed":"As seguintes etiquetas não podem ser adicionadas como sinônimos: \u003cb\u003e%{tag_names}\u003c/b\u003e. Se assegure de que elas não tenham sinônimos e não sejam sinônimos de outras etiquetas.","remove_synonym":"Remover sinônimo","delete_synonym_confirm":"Você tem certeza que deseja excluir o sinônimo \"%{tag_name}\"?","delete_tag":"Apagar marcação","delete_confirm":{"one":"Tem certeza de que deseja excluir esta tag e removê-la de um tópico para o qual ela está atribuída?","other":"Tem certeza de que deseja excluir esta tag e removê-la de {{count}} tópicos aos quais ela está atribuída?"},"delete_confirm_no_topics":"Tem certeza de que deseja excluir esta tag?","delete_confirm_synonyms":{"one":"O sinônimo dela também será excluído.","other":"Os {{count}} sinônimos dela também serão excluídos."},"rename_tag":"Renomear marcador","rename_instructions":"Escolha um novo nome para o marcador","sort_by":"Ordenar por","sort_by_count":"quantidade","sort_by_name":"nome","manage_groups":"Gerenciar grupos de marcadores","manage_groups_description":"Definir grupos para organizar marcadores","upload":"Enviar Etiquetas","upload_description":"Enviar um arquivo csv para criar etiquetas em massa","upload_instructions":"Uma por linha, opcionalmente com um grupo de etiquetas no formato 'nome_etiqueta,grupo_etiqueta'.","upload_successful":"Etiquetas enviadas com sucesso","delete_unused_confirmation":{"one":"%{count} etiqueta será excluída: %{etiquetas}","other":"%{count} etiquetas serão excluídas: %{etiquetas}"},"delete_unused_confirmation_more_tags":{"one":"%{etiquetas} e %{count} mais","other":"%{etiquetas} e %{count} mais"},"delete_unused":"Excluir Etiquetas Não Usadas","delete_unused_description":"Excluir todas as etiquetas que não estão anexadas a nenhum tópico ou mensagem pessoal","cancel_delete_unused":"Cancelar","filters":{"without_category":"%{filter} %{category} Tópicos","with_category":"%{filter} %{tag} tópicos em %{category}","untagged_without_category":"%{filter} tópicos não etiquetados","untagged_with_category":"%{filter} tópicos não etiquetados em %{category}"},"notifications":{"watching":{"title":"Observando","description":"Você assistirá automaticamente todos os tópicos com esta tag. Você será notificado sobre todas as novas postagens e tópicos, além da contagem de postagens não lidas e novas também serão exibidas ao lado do tópico."},"watching_first_post":{"title":"Observando o primeiro post","description":"Você será notificado sobre novos tópicos com esta etiqueta, mas não sobre respostas aos tópicos."},"tracking":{"title":"Monitorando","description":"Você acompanhará automaticamente todos os tópicos com esta tag. Uma contagem de postagens não lidas e novas será exibida ao lado do tópico."},"regular":{"title":"Normal","description":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem."},"muted":{"title":"Silenciado","description":"Você não será notificado de nada sobre novos tópicos com esta tag e eles não aparecerão na guia não lida."}},"groups":{"title":"Grupos de Etiquetas","about":"Adicione marcadores aos grupos para gerenciá-los mais facilmente","new":"Novo grupo","tags_label":"Marcadores neste grupo","tags_placeholder":"etiquetas","parent_tag_label":"Categoria Principal","parent_tag_placeholder":"Opcional","parent_tag_description":"Etiquetas deste grupo não podem ser usadas a menos que a etiqueta principal esteja presente.","one_per_topic_label":"Limite uma etiqueta por tópico deste grupo","new_name":"Novo Grupo de Etiquetas","name_placeholder":"Nome do grupo de etiquetas","save":"Salvar","delete":"Apagar","confirm_delete":"Tem certeza de que deseja remover este grupo de etiquetas?","everyone_can_use":"Etiquetas podem ser usadas por todos","usable_only_by_staff":"As etiquetas são visíveis para todos, mas apenas a equipe pode usá-las","visible_only_to_staff":"As etiquetas são visíveis apenas para a equipe"},"topics":{"none":{"unread":"Não há nenhum tópico não lido.","new":"Você tem tópicos novos","read":"Você ainda não leu nenhum tópico.","posted":"Você ainda não escreveu em nenhum tópico.","latest":"Não há tópicos recentes.","bookmarks":"Você ainda não tem tópicos nos favoritos.","top":"Não há tópicos em alta."},"bottom":{"latest":"Não há mais tópicos recentes.","posted":"Não há mais tópicos postados.","read":"Não há mais tópicos lidos.","new":"Não há mais tópicos novos.","unread":"Não há mais tópicos não lidos.","top":"Não há mais tópicos em alta.","bookmarks":"Não há mais tópicos nos favoritos."}}},"invite":{"custom_message":"Faça o seu convite um pouco mais pessoal escrevendo uma \u003ca href\u003emensagem personalizada\u003c/a\u003e.","custom_message_placeholder":"Insira a sua mensagem personalizada","custom_message_template_forum":"Ei, você devia entrar neste fórum!","custom_message_template_topic":"Ei, eu acho que você vai gostar deste tópico!"},"forced_anonymous":"Devido à carga extrema, isto está sendo exibido temporariamente para todos, visto que um usuário desconectado o veria.","safe_mode":{"enabled":"O modo seguro está habilitado. Para sair do modo seguro feche esta janela do navegador"},"poll":{"voters":{"one":"votante","other":"votantes"},"total_votes":{"one":"voto no total","other":"votos no total"},"average_rating":"Classificação média: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Votos são \u003cstrong\u003epúblicos\u003c/strong\u003e."},"results":{"vote":{"title":"Resultados serão mostrados ao \u003cstrong\u003evotar\u003c/strong\u003e."},"closed":{"title":"Resultados serão mostrados quando a votação \u003cstrong\u003efechar\u003c/strong\u003e."},"staff":{"title":"Resultados são somente mostrados para \u003cstrong\u003efuncionários\u003c/strong\u003e membros."}},"multiple":{"help":{"at_least_min_options":{"one":"Escolha pelo menos \u003cstrong\u003e%{count}\u003c/strong\u003e opção","other":"Escolha pelo menos \u003cstrong\u003e%{count}\u003c/strong\u003e opções"},"up_to_max_options":{"one":"Escolha até \u003cstrong\u003e%{count}\u003c/strong\u003e opção","other":"Escolha até \u003cstrong\u003e%{count}\u003c/strong\u003e opções"},"x_options":{"one":"Escolha \u003cstrong\u003e%{count}\u003c/strong\u003e opção","other":"Escolha \u003cstrong\u003e%{count}\u003c/strong\u003e opções"},"between_min_and_max_options":"Você pode escolher entre \u003cstrong\u003e%{min}\u003c/strong\u003e e \u003cstrong\u003e%{max}\u003c/strong\u003e opções"}},"cast-votes":{"title":"Registre seus votos","label":"Votar agora!"},"show-results":{"title":"Mostrar o resultado da votação","label":"Mostrar resultados"},"hide-results":{"title":"Voltar para os seus votos","label":"Mostrar voto"},"group-results":{"title":"Agrupar votos por campo de usuário","label":"Mostrar detalhamento"},"ungroup-results":{"title":"Combinar todos os votos","label":"Ocultar detalhamento"},"export-results":{"title":"Exportar os resultados da pesquisa","label":"Exportar"},"open":{"title":"Abrir a votação","label":"Abrir","confirm":"Você tem certeza de que deseja abrir esta votação?"},"close":{"title":"Fechar a votação","label":"Fechar","confirm":"Você tem certeza de que deseja fechar esta votação?"},"automatic_close":{"closes_in":"Fecha em \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"Fechou \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Desculpe, houve um erro ao mudar a situação desta votação.","error_while_casting_votes":"Desculpe, houve um erro ao registrar os seus votos.","error_while_fetching_voters":"Desculpe, houve um erro ao mostrar os votantes.","error_while_exporting_results":"Desculpe, houve um erro ao exportar os resultados da pesquisa.","ui_builder":{"title":"Criar Votação","insert":"Inserir Votação","help":{"invalid_values":"O valor mínimo precisa ser menor que o valor máximo.","min_step_value":"O valor mínimo de intervalo é 1"},"poll_type":{"label":"Tipo","regular":"Única Escolha","multiple":"Múltipla Escolha","number":"Classificação Numérica"},"poll_result":{"label":"Resultados","always":"Sempre visível","vote":"Ao votar","closed":"Quando fechada","staff":"Somente pessoal autorizado"},"poll_chart_type":{"label":"Tipo de gráfico"},"poll_config":{"max":"Máx","min":"Mín","step":"Intervalo"},"poll_public":{"label":"Exibir quem votou"},"poll_options":{"label":"Insira uma opção para voto por linha"},"automatic_close":{"label":"Fechar automaticamente a votação"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Iniciar o tutorial de novo usuário para todos os usuários novos","welcome_message":"Enviar uma mensagem de boas vindas com um guia de início rápido para todos os usuários novos"}},"discourse_local_dates":{"relative_dates":{"today":"Hoje %{time}","tomorrow":"Amanhã %{time}","yesterday":"Ontem %{time}","countdown":{"passed":"data já passou"}},"title":"Inserir data / hora","create":{"form":{"insert":"Inserir","advanced_mode":"Modo avançado","simple_mode":"Modo simples","format_description":"Formato usado para exibir a data para o usuário. Use \"\\T\\Z\" para exibir o fuso horário do usuário em palavras (Europa/Paris)","timezones_title":"Fusos horários para exibir","timezones_description":"Os fusos horários serão usados ​​para exibir datas na pré-visualização e no fallback.","recurring_title":"Recorrência","recurring_description":"Defina a recorrência de um evento. Você também pode editar manualmente a opção recorrente gerada pelo formulário e usar uma das seguintes chaves em inglês: years, quarters, months, weeks, days, hours, minutes, seconds, milliseconds.","recurring_none":"Sem recorrência","invalid_date":"Data inválida, certifique-se de que a data e a hora estão corretas","date_title":"Data","time_title":"Hora","format_title":"Formato de data","timezone":"Fuso Horário","until":"Até…","recurring":{"every_day":"Diariamente","every_week":"Semanalmente","every_two_weeks":"Quinzenalmente","every_month":"Mensalmente","every_two_months":"Bimestralmente","every_three_months":"Trimestralmente","every_six_months":"Semestralmente","every_year":"Anualmente"}}}},"details":{"title":"Ocultar Detalhes"},"presence":{"replying":"respondendo","editing":"editando","replying_to_topic":{"one":"respondendo","other":"respondendo"}},"voting":{"title":"Votação","reached_limit":"Você está sem votos, remova um voto existente!","list_votes":"Mostrar seus votos","votes_nav_help":"tópicos com a maioria dos votos","voted":"Você votou neste tópico","allow_topic_voting":"Permitir que usuários votem em tópicos desta categoria","vote_title":"Votar","vote_title_plural":"Votos","voted_title":"Votado","voting_closed_title":"Fechado","voting_limit":"Limite","votes_left":{"one":"Você tem {{count}} voto restante, veja os \u003ca href='{{path}}'\u003eseus votos\u003c/a\u003e.","other":"Você tem {{count}} votos restantes, veja os \u003ca href='{{path}}'\u003eseus votos\u003c/a\u003e."},"votes":{"one":"{{count}} voto","other":"{{count}} votos"},"anonymous_button":{"one":"Voto","other":"Votos"},"remove_vote":"Remover voto"},"adplugin":{"advertisement_label":"PUBLICIDADE"},"docker":{"upgrade":"Sua instalação do Discourse está desatualizada.","perform_upgrade":"Clique aqui para atualizar."}}},"zh_CN":{"js":{"dates":{"long_no_year":"M[月]D[日] HH:mm"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","reminders":{"next_business_day":"下一个工作日","start_of_next_business_week":"下周一","last_custom":"最近","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"directory":{"last_updated":"最近更新："},"user":{"use_current_timezone":"使用现在的时区","change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"invite_code":{"instructions":"账户注册需要邀请码"}},"modal":{"dismiss_error":"忽略错误"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。"},"select_kit":{"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"composer":{"saved_draft":"正在发布草稿。点击以继续。","composer_actions":{"reply_as_new_topic":{"confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"}}},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"titles":{"bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}"}},"topic":{"topic_status_update":{"num_of_days":"天数"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}}},"post":{"bookmarks":{"edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"keyboard_shortcuts_help":{"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"tagging":{"category_restricted":"此标签仅限于你无权访问的分类。","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"}},"poll":{"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"}},"ui_builder":{"help":{"options_count":"至少输入1个选项"},"poll_groups":{"label":"允许的群组"}}}}},"en":{"js":{"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}}},"topic":{"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}}},"post":{"controls":{"publish_page":"Page Publishing"}},"tagging":{"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'pt_BR';
I18n.pluralizationRules.pt_BR = MessageFormat.locale.pt_BR;
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    var ptBr = moment.defineLocale('pt-br', {
        months : 'Janeiro_Fevereiro_Março_Abril_Maio_Junho_Julho_Agosto_Setembro_Outubro_Novembro_Dezembro'.split('_'),
        monthsShort : 'Jan_Fev_Mar_Abr_Mai_Jun_Jul_Ago_Set_Out_Nov_Dez'.split('_'),
        weekdays : 'Domingo_Segunda-feira_Terça-feira_Quarta-feira_Quinta-feira_Sexta-feira_Sábado'.split('_'),
        weekdaysShort : 'Dom_Seg_Ter_Qua_Qui_Sex_Sáb'.split('_'),
        weekdaysMin : 'Do_2ª_3ª_4ª_5ª_6ª_Sá'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D [de] MMMM [de] YYYY',
            LLL : 'D [de] MMMM [de] YYYY [às] HH:mm',
            LLLL : 'dddd, D [de] MMMM [de] YYYY [às] HH:mm'
        },
        calendar : {
            sameDay: '[Hoje às] LT',
            nextDay: '[Amanhã às] LT',
            nextWeek: 'dddd [às] LT',
            lastDay: '[Ontem às] LT',
            lastWeek: function () {
                return (this.day() === 0 || this.day() === 6) ?
                    '[Último] dddd [às] LT' : // Saturday + Sunday
                    '[Última] dddd [às] LT'; // Monday - Friday
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : 'em %s',
            past : 'há %s',
            s : 'poucos segundos',
            ss : '%d segundos',
            m : 'um minuto',
            mm : '%d minutos',
            h : 'uma hora',
            hh : '%d horas',
            d : 'um dia',
            dd : '%d dias',
            M : 'um mês',
            MM : '%d meses',
            y : 'um ano',
            yy : '%d anos'
        },
        dayOfMonthOrdinalParse: /\d{1,2}º/,
        ordinal : '%dº'
    });

    return ptBr;

})));

// moment-timezone-localization for lang code: pt

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidjan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Acra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Adis Abeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Argel","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Cairo","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Conakry","name":"Conacri","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Djibuti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"El Aaiún","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Joanesburgo","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Juba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Cartum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lomé","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadíscio","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monróvia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairóbi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"N’Djamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakchott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"São Tomé","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Trípoli","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Túnis","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Antigua","name":"Antígua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaína","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Rio Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucumã","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Assunção","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahia de Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belém","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogotá","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancún","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Caiena","id":"America/Cayenne"},{"value":"America/Cayman","name":"Cayman","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Córdoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Costa Rica","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiabá","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominica","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepé","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"El Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Granada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadalupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guaiaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guiana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"Havana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianápolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamaica","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceió","id":"America/Maceio"},{"value":"America/Managua","name":"Manágua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinica","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlan","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Mérida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Cidade do México","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevidéu","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"Nova York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Fernando de Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Dakota do Norte","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, Dakota do Norte","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salen, Dakota do Norte","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panamá","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Porto Príncipe","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Porto Rico","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarém","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"São Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"São Bartolomeu","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"Saint John’s","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"São Cristóvão","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Santa Lúcia","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Saint Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"São Vicente","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Syowa","name":"Showa","id":"Antarctica/Syowa"},{"value":"Asia/Aden","name":"Adem","id":"Asia/Aden"},{"value":"Asia/Amman","name":"Amã","id":"Asia/Amman"},{"value":"Asia/Aqtobe","name":"Aqtöbe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Asgabate","id":"Asia/Ashgabat"},{"value":"Asia/Baghdad","name":"Bagdá","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrein","id":"Asia/Bahrain"},{"value":"Asia/Beirut","name":"Beirute","id":"Asia/Beirut"},{"value":"Asia/Damascus","name":"Damasco","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dacca","id":"Asia/Dhaka"},{"value":"Asia/Dushanbe","name":"Duchambe","id":"Asia/Dushanbe"},{"value":"Asia/Hebron","name":"Hebrom","id":"Asia/Hebron"},{"value":"Asia/Jakarta","name":"Jacarta","id":"Asia/Jakarta"},{"value":"Asia/Jerusalem","name":"Jerusalém","id":"Asia/Jerusalem"},{"value":"Asia/Karachi","name":"Carachi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Catmandu","id":"Asia/Katmandu"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lampur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Macau","name":"Macau","id":"Asia/Macau"},{"value":"Asia/Makassar","name":"Macáçar","id":"Asia/Makassar"},{"value":"Asia/Muscat","name":"Mascate","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nicósia","id":"Asia/Nicosia"},{"value":"Asia/Riyadh","name":"Riade","id":"Asia/Riyadh"},{"value":"Asia/Sakhalin","name":"Sacalina","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarcanda","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Xangai","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Cingapura","id":"Asia/Singapore"},{"value":"Asia/Tehran","name":"Teerã","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Timphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tóquio","id":"Asia/Tokyo"},{"value":"Asia/Ulaanbaatar","name":"Ulan Bator","id":"Asia/Ulaanbaatar"},{"value":"Asia/Yekaterinburg","name":"Ecaterimburgo","id":"Asia/Yekaterinburg"},{"value":"Atlantic/Azores","name":"Açores","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermudas","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Canárias","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Cabo Verde","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Ilhas Faroe","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavík","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Geórgia do Sul","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Santa Helena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Etc/UTC","name":"Horário Universal Coordenado","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdã","id":"Europe/Amsterdam"},{"value":"Europe/Astrakhan","name":"Astracã","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Atenas","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrado","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlim","id":"Europe/Berlin"},{"value":"Europe/Brussels","name":"Bruxelas","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bucareste","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapeste","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Büsingen","id":"Europe/Busingen"},{"value":"Europe/Copenhagen","name":"Copenhague","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Horário Padrão da IrlandaDublin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinque","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Ilha de Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Istambul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrado","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kiev","id":"Europe/Kiev"},{"value":"Europe/Lisbon","name":"Lisboa","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Liubliana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Horário de Verão BritânicoLondres","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luxemburgo","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madri","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Monaco","name":"Mônaco","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moscou","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Paris","id":"Europe/Paris"},{"value":"Europe/Prague","name":"Praga","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Roma","id":"Europe/Rome"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Sofia","name":"Sófia","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Estocolmo","id":"Europe/Stockholm"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Ulianovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Vatican","name":"Vaticano","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Viena","id":"Europe/Vienna"},{"value":"Europe/Volgograd","name":"Volgogrado","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varsóvia","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporizhia","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zurique","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Comoro","name":"Comores","id":"Indian/Comoro"},{"value":"Indian/Mahe","name":"Mahé","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldivas","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Maurício","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Reunião","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Ápia","id":"Pacific/Apia"},{"value":"Pacific/Easter","name":"Ilha de Páscoa","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Éfaté","id":"Pacific/Efate"},{"value":"Pacific/Galapagos","name":"Galápagos","id":"Pacific/Galapagos"},{"value":"Pacific/Honolulu","name":"Honolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Noumea","name":"Nouméa","id":"Pacific/Noumea"},{"value":"Pacific/Tahiti","name":"Taiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Taraua","id":"Pacific/Tarawa"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
