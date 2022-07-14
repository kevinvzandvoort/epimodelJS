function toggleDiv(element, icon){
  if(element.classList.contains("hidden")){
    element.classList.remove("hidden");
    icon.innerHTML = "−";
  } else {
    element.classList.add("hidden");
    icon.innerHTML = "+";
  }
}

let TransmissionModel = class {
  //model_states is an array with objects for each model state
  //model parameters is an array with each parameter used in the model
  //updateState is a function to model a single timestep
  //id is the HTML id for the model wrapper
  constructor(model_states, model_parameters, updateState, calculateR0, id, model_configuration) {
    this.model_states = model_states;
    this.model_parameters = model_parameters;
    this.updateState = updateState;
    this.calculateR0 = calculateR0;
    this.model_configuration = model_configuration;

    //Default configuration options
    this.configuration = new Object();
    this.model_configuration.forEach(o => {
      if(o.var == "model_plot_percentage"){
        this.configuration.plot_percentage = (o.init == 'percentage');
      } else if(o.var == "model_years"){
        this.configuration.model_days = o.init * 365;
      } else if(o.var == "model_deterministic"){
         this.configuration.model_deterministic = (o.init == 'deterministic');
      } else {
        this.configuration[o.var] = (o.init);
      }
    });
    //this.configuration.model_days = this.configuration.model_years * 365; //total days to be modelled
    //this.configuration.model_day_timesteps = 4; //number of timesteps to use per day
    //this.configuration.model_save_days = 30; //save output every x days (want to save memory)
    //this.configuration.plot_percentage = (this.model_configuration.model_plot_percentage == 'percentage'); //plot percentage or absolute number?

    //Check that all required states are present
    this.state_current = new Object;
    this.state_init = new Object;
    this.model_states.forEach(s => {
      this.state_current[s.var] = parseFloat(s.init);
      this.state_init[s.var] = parseFloat(s.init);
    });

    //Check that all required parameters are present
    this.parameters = new Object;
    this.params = new Object;
    this.model_parameters.forEach(p => {
      this.parameters[p.var] = p.init;
      this.params[p.var] = p.init;
    });

    //Additional summary information
    this.summary = new Object;

    //Adjust some parameters if needed
    this.adjustParams();

    //Prepare object to export values
    this.processConfig();

    //Create HTML elements
    this.model_wrapper = document.getElementById(id);
    this.createInputFields();
    this.createPlotCanvas();

    this.calculateR0();
    this.showSummary();
    this.runModel();
    this.updatePlotData();
    this.showPlot();
  }

  showSummary(){
    this.summary_block.innerHTML = "";
    if(this.summary.R0){
      let R0span = document.createElement("p");
      R0span.innerHTML = "With the selected parameter values, the basic reproduction number (R0) is " + (this.summary.R0).toFixed(2) + ".";
      this.summary_block.appendChild(R0span);
      let explanation = document.createElement("p");
      explanation.innerHTML = "Compartments can be toggled to be shown or hidden by clicking on their labels above the plot.<br>While the left y-axis shows the values of the epidemiological compartments, the right y-axis shows the net reproduction number over time.";
      this.summary_block.appendChild(explanation);
    }
  }

  createInputFields(){
    let input_fields = document.createElement("div");
    input_fields.className = "input_fields";

    let input_parameters = document.createElement("div");
    let input_parameters_title = document.createElement("h2");
    input_parameters_title.innerHTML = "Model parameters";
    let input_parameters_toggle = document.createElement("span");
    input_parameters_toggle.innerHTML = "−";
    input_parameters_toggle.className = "toggle_button";
    input_parameters_title.appendChild(input_parameters_toggle);
    input_parameters.appendChild(input_parameters_title);

    let input_parameters_form = document.createElement("div");
    input_parameters_form.className = "form";
    this.model_parameters.forEach(p => {
      let label = document.createElement("label");
      label.for = label.setAttribute('for', p.var);
      label.innerHTML = p.name;

      let input = document.createElement("input");
      input.type = (p.type ? p.type : "number");
      input.name = p.var;
      input.id = p.var;
      input.value = p.init;
      input.min = 0;
      if(p.min > 0){
        input.addEventListener("change", () => {
          if(input.value < p.min) input.value = p.min;
        });
      }
      input.max = p.max;
      if(p.step) input.step = p.step;

      input_parameters_form.appendChild(label);
      input_parameters_form.appendChild(input);
      //input_parameters.appendChild(document.createElement("br"));
    });
    input_parameters.appendChild(input_parameters_form);
    input_fields.appendChild(input_parameters);
    this.input_parameters = input_parameters;
    input_parameters_title.addEventListener("click", ()=>{
      toggleDiv(input_parameters_form, input_parameters_toggle);
    });

    let input_states = document.createElement("div");
    let input_states_title = document.createElement("h2");
    input_states_title.innerHTML = "Initial states";
    let input_states_toggle = document.createElement("span");
    input_states_toggle.innerHTML = "−";
    input_states_toggle.className = "toggle_button";
    input_states_title.appendChild(input_states_toggle);
    input_states.appendChild(input_states_title);

    let input_states_form = document.createElement("div");
    input_states_form.className = "form";
    this.model_states.forEach(s => {
      if(s.hide_input) return(0);
      let label = document.createElement("label");
      label.for = label.setAttribute('for', s.var);
      label.innerHTML = s.name;

      let input = document.createElement("input");
      input.type = (s.type ? s.type : "number");
      input.name = s.var;
      input.id = s.var;
      input.value = s.init;
      input.min = 0;
      if(s.min > 0){
        input.addEventListener("change", () => {
          if(input.value < s.min) input.value = s.min;
        });
      }
      input.max = s.max;
      if(s.step) input.step = s.step;

      input_states_form.appendChild(label);
      input_states_form.appendChild(input);
      //input_states.appendChild(document.createElement("br"));
    });
    input_states.appendChild(input_states_form);
    input_fields.appendChild(input_states);
    this.input_states = input_states;
    input_states_title.addEventListener("click", ()=>{
      toggleDiv(input_states_form, input_states_toggle);
    });

    let input_config = document.createElement("div");
    let input_config_title = document.createElement("h2");
    input_config_title.innerHTML = "Configuration";
    let input_config_toggle = document.createElement("span");
    input_config_toggle.innerHTML = "+";
    input_config_toggle.className = "toggle_button";
    input_config_title.appendChild(input_config_toggle);
    input_config.appendChild(input_config_title);

    let input_config_form = document.createElement("div");
    input_config_form.className = "form";
    input_config_form.classList.add("hidden");
    this.model_configuration.forEach(o => {
      let label = document.createElement("label");
      if(!o.type | o.type == "number") label.setAttribute('for', o.var);
      label.innerHTML = o.name;
      input_config_form.appendChild(label);

      if(!o.type | o.type == "number"){
        let input = document.createElement("input");
        input.type = (o.type ? o.type : "number");
        input.name = o.var;
        input.id = o.var;
        input.value = o.init;
        input.min = 0;
        if(o.min > 0){
          input.addEventListener("change", () => {
            if(input.value < o.min) input.value = o.min;
          });
        }
        input.max = o.max;
        if(o.step) input.step = o.step;
        input_config_form.appendChild(input);
      } else {
        let input_wrapper = document.createElement("div");
        o.options.forEach((p) => {
          let input = document.createElement("input");
          input.type = (o.type ? o.type : "number");
          input.name = o.var;
          input.id = p;
          input.value = p;
          if(p == o.init) input.checked = true;
          let input_label = document.createElement("label");
          input_label.setAttribute('for', p);
          console.log("INPUT FOR: "+p);
          input_label.innerHTML = p;
          input_wrapper.appendChild(input);
          input_wrapper.appendChild(input_label);
        });
        input_config_form.appendChild(input_wrapper);
      }

      //input_config.appendChild(document.createElement("br"));
    });
    input_config.appendChild(input_config_form);
    input_fields.appendChild(input_config);
    this.input_config = input_config;
    input_config_title.addEventListener("click", ()=>{
      toggleDiv(input_config_form, input_config_toggle);
    });

    let update_button = document.createElement("button");
    update_button.innerHTML = "Rerun model";
    update_button.addEventListener('click', () => {
      this.updateConfig();
      this.updateStates();
      this.processConfig();
      this.updateParameters();
      this.calculateR0();
      this.showSummary();
      this.runModel();
      this.updatePlotData();
      this.showPlot();
    });

    input_fields.appendChild(update_button);
    this.model_wrapper.appendChild(input_fields);

    let summary_block = document.createElement("div");
    this.model_wrapper.appendChild(summary_block);
    this.summary_block = summary_block;
  }

  createPlotCanvas(){
    let plot_wrapper = document.createElement("div");
    plot_wrapper.className = "plot_wrapper";

    let plot_canvas = document.createElement("canvas");
    this.model_plot_id = "model_plot";
    plot_canvas.id = this.model_plot_id;

    plot_wrapper.appendChild(plot_canvas);
    this.model_wrapper.appendChild(plot_wrapper);
  }

  //Adjust model parameter
  adjustParams(){
    this.model_parameters.forEach(p => {
      switch(p.adj){
        case "/": this.params[p.var] = parseFloat(this.parameters[p.var]) / this.configuration.model_day_timesteps; break;
        case "*": this.params[p.var] = parseFloat(this.parameters[p.var]) * this.configuration.model_day_timesteps; break;
        case "": this.params[p.var] = parseFloat(this.parameters[p.var]); break;
        default: throw("Can only adjust using * or /, or use no adjustment");
      }
    });
  }

  updateStates(){
    let state_values = this.input_states.querySelectorAll("input");
    state_values.forEach((s) => {
      console.log("Updating "+ s.name + " to " + s.value);
      this.state_init[s.name] = parseFloat(s.value);
    });
  }

  updateConfig(){
    let config_values = this.input_config.querySelectorAll("input");
    config_values.forEach((o) => {
      if(o.type == "radio" & !o.checked) return 0;
      console.log("Updating "+ o.name + " to " + o.value);
      if(o.name == "model_plot_percentage"){
        this.configuration.plot_percentage = (o.value == 'percentage');
      } else if(o.name == "model_years"){
        this.configuration.model_days = o.value * 365;
      } else if(o.name == "model_deterministic"){
         this.configuration.model_deterministic = (o.value == 'deterministic');
      } else {
        this.configuration[o.name] = (o.value);
      }
    });
    if(this.configuration.model_deterministic) this.configuration.model_runs = 1;
    //ensure parameters are adjusted if necessary
    this.adjustParams();
  }

  rbinom(n, prob){
    let y = 0;
    for(let i=0; i<n; i++) y += (Math.random() < prob);
    return y;
  }

  processConfig(){
    this.output = new Object();
    let total_saved_timesteps = Math.ceil(this.configuration.model_days / this.configuration.model_save_days);
    this.output.time = Array(total_saved_timesteps);
    this.output.runs = Array(this.configuration.model_runs);
    for(let r=0; r < this.configuration.model_runs; r++){
      this.output.runs[r] = new Object();
      Object.entries(this.state_init).forEach(([key, val]) => {
        this.output.runs[r][key] = Array(total_saved_timesteps);
      });
    }
  }

  updateParameters(){
    let parameter_values = this.input_parameters.querySelectorAll("input");
    parameter_values.forEach((p) => {
      console.log("Updating "+ p.name + " to " + p.value);
      this.parameters[p.name] = p.value;
    });

    //ensure parameters are adjusted if necessary
    this.adjustParams();
  }

  //Loop over all timesteps in the model
  runModel(){
    for(let i=0; i < (this.configuration.model_deterministic ? 1 : this.configuration.model_runs); i++){
      console.log("START MODEL "+(i+1)+"/"+(this.configuration.model_deterministic ? 1 : this.configuration.model_runs));
      //Note t=0 will hold initial state
      this.model_states.forEach(s => {
        this.output.runs[i][s.var][0] = parseFloat(this.state_init[s.var]);//(isNaN(this.state_init[s.var]) ? eval(this.state_init[s.var]) : parseFloat(this.state_init[s.var]));
        this.state_current[s.var] = parseFloat(this.state_init[s.var]);//(isNaN(this.state_init[s.var]) ? eval(this.state_init[s.var]) : parseFloat(this.state_init[s.var]));
      });

      var reported = false;
      for(let t = 1; t < (this.configuration.model_days * this.configuration.model_day_timesteps); t++){
        //potentially check to stop stochastic runs when I == 0
        this.updateState(t, this.configuration.model_deterministic, reported);

        //only save select timesteps
        let time_save_position = t / (this.configuration.model_save_days * this.configuration.model_day_timesteps);
        if(((time_save_position) % 1.0) == 0.0){
          this.model_states.forEach(s => {
            this.output.runs[i][s.var][time_save_position] = this.state_current[s.var];
          });
          reported = true;
        } else {
          reported = false;
        }
      }
      console.log("FINISH MODEL "+(i+1)+"/"+(this.configuration.model_deterministic ? 1 : this.configuration.model_runs));
    }
  }

  getModelOutput(){
    return this.output;
  }

  updatePlotData(){
    var labels = Array(Math.ceil(this.configuration.model_days / this.configuration.model_save_days));
    labels[0] = 0;
    for(let t=1; t < labels.length; t++){
      labels[t] = t*this.configuration.model_save_days;
    }
    labels = labels.slice(Math.floor((this.configuration.model_plot_start_year * 365)/this.configuration.model_save_days));

    this.plotdata = {labels: labels, datasets: []}

    var N = 0;
    this.model_states.forEach(s => {
      //States that are used to track Rt and Incidence are not used to calculate N
      if(s.hide_input) return(0);
      N += this.state_init[s.var];
    });

    this.model_states.forEach(s => {
      if(!s.show_state) return 0;
      if(!this.configuration.model_plot_output.includes(s.epitype)) return 0

      this.output.runs.forEach((r, i)=>{
        var data = r[s.var];

        //temporarily overwrite initial value Rt
        if(s.var == "Rt"){
          data[0] = this.summary.R0 * this.state_init["S"]/(N);
        }

        data = data.slice(Math.floor((this.configuration.model_plot_start_year * 365)/this.configuration.model_save_days));

        if(this.configuration.model_plot_output.includes("cum")){
          var d = 0;
          for(let j = 0, length = data.length; j < length; j++){
            d += data[j];
            data[j] = d;
          }
        }
        if(this.configuration.plot_percentage){
          for(let j = 0, length = data.length; j < length; j++){
            if(!s.nopercentage) data[j] = (data[j]/N) * 100;
          }
        }

        this.plotdata.datasets.push({
          label: s.name + (this.configuration.model_runs > 1 ? " (run " + (i+1) + ")" : ""),
          backgroundColor: s.colour,
          borderColor: s.colour,
          data: data,
          yAxisID: s.yaxis
        });
      });
    });
  }

  //using ChartJS to plot results
  showPlot(){
    //destroy old plot
    if(this.hasOwnProperty("plot")) this.plot.destroy();

    this.plot = new Chart(
      document.getElementById(this.model_plot_id),
      {
        type: 'line', data: this.plotdata,
        ////stacked: false,
        options: {
          ////responsive: true,
          ////interaction: {intersect: false, mode: 'index'},
          animation: {duration: 0},
          scales: {
            left: {position: 'left', type: 'linear', title: {display: true, text: (this.configuration.plot_percentage ? "Percentage of population" : "Total number of people")}},
            right: {position: 'right', type: 'linear', title: {display: true, text: "Net reproduction number (Rt)"}, grid: {drawOnChartArea: false}},
            bottom: {position: 'bottom', type: 'linear', title: {display: true, text: "Days (since start of simulation)"}, grid: {drawOnChartArea: true}, max: Math.floor(this.configuration.model_days)}
          }
        }
      }
    );
  }

}
